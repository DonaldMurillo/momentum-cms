import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seoPlugin } from '../seo-plugin';
import type { SeoPluginConfig } from '../seo-config.types';
import type { PluginContext, PluginReadyContext, MomentumAPI } from '@momentumcms/plugins/core';
import type { CollectionConfig, TabsField } from '@momentumcms/core';
import { hasSeoField } from '../seo-utils';

function makeConfig(overrides: Partial<SeoPluginConfig> = {}): SeoPluginConfig {
	return {
		collections: ['posts', 'pages'],
		siteUrl: 'https://example.com',
		...overrides,
	};
}

function makeCollection(slug: string, hasSeo = false): CollectionConfig {
	const fields = [{ name: 'title', type: 'text' as const, label: 'Title' }];
	if (hasSeo) {
		fields.push({ name: 'seo', type: 'group' as const, label: 'SEO' } as never);
	}
	return { slug, fields, labels: { singular: slug, plural: slug } } as CollectionConfig;
}

function makePluginContext(collections: CollectionConfig[] = []): PluginContext {
	return {
		collections,
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
		registerMiddleware: vi.fn(),
	} as unknown as PluginContext;
}

function makeMomentumApi(): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			find: vi.fn().mockResolvedValue({ docs: [] }),
			create: vi.fn().mockResolvedValue({}),
		}),
		getConfig: vi.fn(),
	} as unknown as MomentumAPI;
}

function makeReadyContext(api?: MomentumAPI): PluginReadyContext {
	return {
		api: api ?? makeMomentumApi(),
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
	} as unknown as PluginReadyContext;
}

describe('seoPlugin', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should return a plugin with name "seo"', () => {
		const plugin = seoPlugin(makeConfig());
		expect(plugin.name).toBe('seo');
	});

	it('should declare adminRoutes by default', () => {
		const plugin = seoPlugin(makeConfig());
		expect(plugin.adminRoutes).toBeDefined();
		expect(plugin.adminRoutes?.length).toBeGreaterThanOrEqual(3);
		expect(plugin.adminRoutes?.[0].path).toBe('seo');
		expect(plugin.adminRoutes?.[0].label).toBe('SEO');
		expect(plugin.adminRoutes?.[1].path).toBe('seo/sitemap');
		expect(plugin.adminRoutes?.[1].label).toBe('Sitemap');
		expect(plugin.adminRoutes?.[2].path).toBe('seo/robots');
		expect(plugin.adminRoutes?.[2].label).toBe('Robots');
	});

	it('should declare no adminRoutes when adminDashboard is false', () => {
		const plugin = seoPlugin(makeConfig({ adminDashboard: false }));
		expect(plugin.adminRoutes).toEqual([]);
	});

	it('should declare browserImports for admin config generator', () => {
		const plugin = seoPlugin(makeConfig());
		expect(plugin.browserImports).toBeDefined();
		expect(plugin.browserImports?.['adminRoutes']).toBeDefined();
		expect(plugin.browserImports?.['modifyCollections']).toBeDefined();
	});

	it('should have a modifyCollections function that injects seo fields', () => {
		const plugin = seoPlugin(makeConfig({ collections: ['posts'] }));
		const collections = [makeCollection('posts')];
		plugin.modifyCollections?.(collections);
		expect(hasSeoField(collections[0])).toBe(true);
	});

	it('modifyCollections should be idempotent', () => {
		const plugin = seoPlugin(makeConfig({ collections: ['posts'] }));
		const collections = [makeCollection('posts')];
		plugin.modifyCollections?.(collections);
		plugin.modifyCollections?.(collections);
		// Should still have exactly one tabs field with one seo tab
		const tabsFields = collections[0].fields.filter((f) => f.type === 'tabs');
		expect(tabsFields).toHaveLength(1);
		const tf = tabsFields[0] as TabsField;
		expect(tf.tabs.filter((t) => t.name === 'seo')).toHaveLength(1);
	});

	it('modifyCollections should skip when enabled is false', () => {
		const plugin = seoPlugin(makeConfig({ enabled: false }));
		const collections = [makeCollection('posts')];
		plugin.modifyCollections?.(collections);
		expect(hasSeoField(collections[0])).toBe(false);
	});

	describe('onInit', () => {
		it('should inject seo fields into collections', async () => {
			const plugin = seoPlugin(makeConfig({ collections: ['posts'] }));
			const collections = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(hasSeoField(collections[0])).toBe(true);
		});

		it('should register sitemap middleware at root level', async () => {
			const plugin = seoPlugin(makeConfig({ sitemap: true }));
			const ctx = makePluginContext([]);
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/', position: 'root' }),
			);
		});

		it('should register robots middleware at root level', async () => {
			const plugin = seoPlugin(makeConfig({ robots: true }));
			const ctx = makePluginContext([]);
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/', position: 'root' }),
			);
		});

		it('should register meta API middleware when enabled', async () => {
			const plugin = seoPlugin(makeConfig({ metaApi: true }));
			const ctx = makePluginContext([]);
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/seo' }),
			);
		});

		it('should only register dashboard middleware when sitemap/robots/meta disabled', async () => {
			const plugin = seoPlugin(makeConfig({ sitemap: false, robots: false, metaApi: false }));
			const ctx = makePluginContext([]);
			await plugin.onInit?.(ctx);
			// Only the dashboard analyses endpoint should be registered
			expect(ctx.registerMiddleware).toHaveBeenCalledTimes(1);
		});

		it('should skip all when enabled is false', async () => {
			const plugin = seoPlugin(makeConfig({ enabled: false }));
			const ctx = makePluginContext([makeCollection('posts')]);
			await plugin.onInit?.(ctx);
			expect(ctx.registerMiddleware).not.toHaveBeenCalled();
			expect(hasSeoField(ctx.collections[0])).toBe(false);
		});

		it('should add seo-analysis collection when analysis enabled', async () => {
			const plugin = seoPlugin(makeConfig({ analysis: true }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(collections.some((c) => c.slug === 'seo-analysis')).toBe(true);
		});

		it('should NOT add seo-analysis collection when analysis disabled', async () => {
			const plugin = seoPlugin(makeConfig({ analysis: false }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(collections.some((c) => c.slug === 'seo-analysis')).toBe(false);
		});

		it('should not duplicate seo-analysis collection when onInit is called twice', async () => {
			const plugin = seoPlugin(makeConfig({ collections: ['posts'], analysis: true }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			await plugin.onInit?.(ctx);
			// seo-analysis should appear exactly once despite two onInit calls
			const analysisCollections = collections.filter((c) => c.slug === 'seo-analysis');
			expect(analysisCollections).toHaveLength(1);
			// SEO tab should appear exactly once (injectSeoFields is idempotent)
			const tf = collections[0].fields.find((f) => f.type === 'tabs') as TabsField;
			expect(tf.tabs.filter((t) => t.name === 'seo')).toHaveLength(1);
		});

		it('should add seo-sitemap-settings collection when sitemap enabled', async () => {
			const plugin = seoPlugin(makeConfig({ sitemap: true }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(collections.some((c) => c.slug === 'seo-sitemap-settings')).toBe(true);
		});

		it('should NOT add seo-sitemap-settings collection when sitemap disabled', async () => {
			const plugin = seoPlugin(makeConfig({ sitemap: false }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(collections.some((c) => c.slug === 'seo-sitemap-settings')).toBe(false);
		});

		it('should add seo-settings collection when robots enabled', async () => {
			const plugin = seoPlugin(makeConfig({ robots: true }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(collections.some((c) => c.slug === 'seo-settings')).toBe(true);
		});

		it('should NOT add seo-settings collection when robots disabled', async () => {
			const plugin = seoPlugin(makeConfig({ robots: false }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			expect(collections.some((c) => c.slug === 'seo-settings')).toBe(false);
		});

		it('should not duplicate seo-sitemap-settings when onInit is called twice', async () => {
			const plugin = seoPlugin(makeConfig({ sitemap: true, collections: ['posts'] }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			await plugin.onInit?.(ctx);
			await plugin.onInit?.(ctx);
			const settingsCollections = collections.filter((c) => c.slug === 'seo-sitemap-settings');
			expect(settingsCollections).toHaveLength(1);
		});

		it('should register sitemap settings middleware when sitemap enabled', async () => {
			const plugin = seoPlugin(makeConfig({ sitemap: true, robots: false, metaApi: false }));
			const ctx = makePluginContext([]);
			await plugin.onInit?.(ctx);
			// Sitemap router + sitemap settings router + dashboard = 3
			expect(ctx.registerMiddleware).toHaveBeenCalledTimes(3);
		});

		it('should inject analysis hooks when analysis enabled', async () => {
			const plugin = seoPlugin(makeConfig({ analysis: true, collections: ['posts'] }));
			const collections: CollectionConfig[] = [makeCollection('posts')];
			const ctx = makePluginContext(collections);
			// First, fields are injected, then hooks
			await plugin.onInit?.(ctx);
			// The collection should now have seo field + afterChange hook
			expect(collections[0].hooks?.afterChange).toBeDefined();
			expect(collections[0].hooks?.afterChange?.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('onReady', () => {
		it('should store the API reference', async () => {
			const plugin = seoPlugin(makeConfig());
			const api = makeMomentumApi();
			const readyCtx = makeReadyContext(api);
			await plugin.onReady?.(readyCtx);
			// Verify it doesn't throw — API is stored internally
			expect(readyCtx.logger.info).toHaveBeenCalled();
		});

		it('should skip when enabled is false', async () => {
			const plugin = seoPlugin(makeConfig({ enabled: false }));
			const readyCtx = makeReadyContext();
			await plugin.onReady?.(readyCtx);
			expect(readyCtx.logger.info).not.toHaveBeenCalled();
		});
	});

	describe('onShutdown', () => {
		it('should log shutdown', async () => {
			const plugin = seoPlugin(makeConfig());
			const shutdownCtx = {
				logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
			};
			await plugin.onShutdown?.(shutdownCtx as unknown as PluginContext);
			expect(shutdownCtx.logger.info).toHaveBeenCalled();
		});
	});
});

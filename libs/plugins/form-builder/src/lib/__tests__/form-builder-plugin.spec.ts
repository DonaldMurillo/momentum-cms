import { describe, it, expect, vi } from 'vitest';
import { formBuilderPlugin } from '../form-builder-plugin';
import { FormsCollection } from '../collections/forms.collection';
import { FormSubmissionsCollection } from '../collections/form-submissions.collection';
import type { PluginContext, PluginReadyContext, CollectionConfig } from '@momentumcms/core';

function createMockContext(overrides?: Partial<PluginContext>): PluginContext {
	return {
		config: {} as PluginContext['config'],
		collections: [] as CollectionConfig[],
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
		...overrides,
	};
}

describe('formBuilderPlugin', () => {
	it('should create a plugin with the correct name', () => {
		const plugin = formBuilderPlugin();
		expect(plugin.name).toBe('form-builder');
	});

	it('should declare forms and form-submissions collections', () => {
		const plugin = formBuilderPlugin();
		expect(plugin.collections).toContain(FormsCollection);
		expect(plugin.collections).toContain(FormSubmissionsCollection);
	});

	it('should have all lifecycle hooks', () => {
		const plugin = formBuilderPlugin();
		expect(plugin.onInit).toBeDefined();
		expect(plugin.onReady).toBeDefined();
		expect(plugin.onShutdown).toBeDefined();
	});

	it('should declare admin routes array', () => {
		const plugin = formBuilderPlugin();
		expect(plugin.adminRoutes).toBeDefined();
		expect(Array.isArray(plugin.adminRoutes)).toBe(true);
	});

	it('should declare browserImports for admin routes', () => {
		const plugin = formBuilderPlugin();
		expect(plugin.browserImports).toBeDefined();
		expect(plugin.browserImports?.adminRoutes).toEqual({
			path: '@momentumcms/plugins-form-builder/admin-routes',
			exportName: 'FORM_BUILDER_ADMIN_ROUTES',
		});
	});

	describe('onInit', () => {
		it('should push collections if not already present', async () => {
			const plugin = formBuilderPlugin();
			const collections: CollectionConfig[] = [];
			const ctx = createMockContext({ collections });

			await plugin.onInit?.(ctx);

			expect(collections).toContain(FormsCollection);
			expect(collections).toContain(FormSubmissionsCollection);
		});

		it('should not double-push collections if already present', async () => {
			const plugin = formBuilderPlugin();
			const collections: CollectionConfig[] = [FormsCollection, FormSubmissionsCollection];
			const ctx = createMockContext({ collections });

			await plugin.onInit?.(ctx);

			const formsSlugs = collections.filter((c) => c.slug === 'forms');
			expect(formsSlugs).toHaveLength(1);
		});

		it('should register middleware', async () => {
			const plugin = formBuilderPlugin();
			const registerMiddleware = vi.fn();
			const ctx = createMockContext({ registerMiddleware });

			await plugin.onInit?.(ctx);

			expect(registerMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({
					path: '/',
					position: 'before-api',
				}),
			);
		});

		it('should log initialization message', async () => {
			const plugin = formBuilderPlugin({ honeypot: true, rateLimitPerMinute: 20 });
			const ctx = createMockContext();

			await plugin.onInit?.(ctx);

			expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('honeypot=true'));
			expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('rateLimit=20/min'));
		});
	});

	describe('onReady', () => {
		it('should store an elevated API with admin context', async () => {
			const plugin = formBuilderPlugin();
			const elevatedApi = { collection: vi.fn() };
			const mockApi = {
				collection: vi.fn(),
				setContext: vi.fn().mockReturnValue(elevatedApi),
			} as unknown as PluginReadyContext['api'];
			const ctx = {
				...createMockContext(),
				api: mockApi,
			} as PluginReadyContext;

			await plugin.onReady?.(ctx);

			expect(mockApi.setContext).toHaveBeenCalledWith({
				user: { id: 'system:form-builder', role: 'admin' },
			});
			expect(ctx.logger.info).toHaveBeenCalledWith('Form builder plugin ready');
		});
	});

	describe('onShutdown', () => {
		it('should log shutdown message', async () => {
			const plugin = formBuilderPlugin();
			const ctx = createMockContext();

			await plugin.onShutdown?.(ctx);

			expect(ctx.logger.info).toHaveBeenCalledWith('Form builder plugin shut down');
		});
	});
});

import { describe, it, expect, vi } from 'vitest';
import { generateAdminConfig } from '../generate-admin-config';
import { computeRelativeImport } from '../generator-types';

// ============================================
// computeRelativeImport Tests
// ============================================

describe('computeRelativeImport', () => {
	it('should compute relative path in same directory', () => {
		const result = computeRelativeImport(
			'/app/src/generated/momentum.config.ts',
			'/app/src/generated/momentum.types.ts',
		);
		expect(result).toBe('./momentum.types');
	});

	it('should compute relative path in different directories', () => {
		const result = computeRelativeImport(
			'/app/libs/config/src/momentum.config.ts',
			'/app/libs/types/src/momentum.types.ts',
		);
		expect(result).toBe('../../types/src/momentum.types');
	});
});

// ============================================
// generateAdminConfig Tests (Inlined Output)
// ============================================

describe('generateAdminConfig', () => {
	it('should generate header and MomentumAdminConfig import', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('AUTO-GENERATED');
		expect(output).toContain("import type { MomentumAdminConfig } from '@momentumcms/core';");
	});

	it('should import CollectionSlug from types file', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('import type { CollectionSlug } from "./momentum.types";');
	});

	it('should import GlobalSlug when globals exist', () => {
		const config = {
			collections: [],
			globals: [{ slug: 'settings', fields: [] }],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('import type { CollectionSlug, GlobalSlug } from "./momentum.types";');
	});

	it('should not import GlobalSlug when no globals', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).not.toContain('GlobalSlug');
	});

	it('should export typed MomentumAdminConfig with CollectionSlug', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('export const adminConfig: MomentumAdminConfig<CollectionSlug> = {');
	});

	it('should export typed MomentumAdminConfig with CollectionSlug and GlobalSlug', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			globals: [{ slug: 'settings', fields: [] }],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain(
			'export const adminConfig: MomentumAdminConfig<CollectionSlug, GlobalSlug> = {',
		);
	});

	it('should inline collections as object literals', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'title', type: 'text', required: true }],
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('collections: [');
		expect(output).toContain('slug: "posts"');
		expect(output).toContain('name: "title"');
		expect(output).toContain('type: "text"');
		expect(output).toContain('required: true');
	});

	it('should inline globals as object literals', () => {
		const config = {
			collections: [],
			globals: [
				{
					slug: 'site-settings',
					label: 'Site Settings',
					fields: [{ name: 'siteName', type: 'text' }],
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('globals: [');
		expect(output).toContain('slug: "site-settings"');
		expect(output).toContain('label: "Site Settings"');
	});

	it('should merge plugin collections into top-level collections', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			plugins: [
				{
					name: 'auth',
					collections: [{ slug: 'auth-user', fields: [{ name: 'email', type: 'email' }] }],
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('slug: "posts"');
		expect(output).toContain('slug: "auth-user"');
		// Both in the collections array, not via plugin imports
		expect(output).not.toContain("from '@momentumcms/auth");
	});

	it('should apply modifyCollections at build time', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
			plugins: [
				{
					name: 'analytics',
					modifyCollections(collections: unknown[]): void {
						for (const c of collections) {
							const col = c as { fields: Array<{ name: string; type: string }> };
							col.fields.push({ name: 'analytics_id', type: 'text' });
						}
					},
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		// The injected field should be present in the inlined output
		expect(output).toContain('analytics_id');
	});

	it('should import plugin admin routes via browserImports', () => {
		const config = {
			collections: [],
			plugins: [
				{
					name: 'analytics',
					adminRoutes: [
						{
							path: 'analytics',
							loadComponent: () => Promise.resolve({}),
							label: 'Analytics',
							icon: 'chart',
						},
					],
					browserImports: {
						adminRoutes: {
							path: '@momentumcms/plugins-analytics/admin-routes',
							exportName: 'analyticsAdminRoutes',
						},
					},
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain(
			'import { analyticsAdminRoutes } from "@momentumcms/plugins-analytics/admin-routes";',
		);
		expect(output).toContain('adminRoutes: analyticsAdminRoutes');
	});

	it('should serialize admin settings', () => {
		const config = {
			collections: [],
			admin: { basePath: '/admin', branding: { title: 'My CMS' }, toasts: true },
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('admin: {');
		expect(output).toContain('basePath: "/admin"');
		expect(output).toContain('title: "My CMS"');
		expect(output).toContain('toasts: true');
	});

	it('should skip server-only plugins (no admin routes)', () => {
		const config = {
			collections: [],
			plugins: [{ name: 'server-only-plugin' }],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).not.toContain('server-only-plugin');
		expect(output).not.toContain('plugins:');
	});

	it('should not contain server-only imports', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			plugins: [
				{
					name: 'auth',
					collections: [{ slug: 'auth-user', fields: [] }],
					browserImports: {
						collections: {
							path: '@momentumcms/auth/collections',
							exportName: 'AUTH_COLLECTIONS',
						},
					},
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		// Should NOT import user collection files
		expect(output).not.toContain('better-auth');
		expect(output).not.toContain('@momentumcms/db-drizzle');
		expect(output).not.toContain('@momentumcms/storage');
		expect(output).not.toContain("from 'pg'");
		expect(output).not.toContain("from 'node:");
		// Should NOT import plugin collections (they're inlined)
		expect(output).not.toContain('AUTH_COLLECTIONS');
	});

	it('should handle plugin with collections but no browserImports or adminRoutes', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			plugins: [
				{
					name: 'data-plugin',
					collections: [{ slug: 'data-items', fields: [{ name: 'value', type: 'number' }] }],
					// no browserImports, no adminRoutes
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		// Plugin collections should be merged into collections
		expect(output).toContain('slug: "data-items"');
		// No plugins section should be emitted (no admin routes)
		expect(output).not.toContain('plugins:');
		// No import statements for plugin admin routes
		const importLines = output.match(/^import\s+\{.*\}\s+from\s+/gm) ?? [];
		const pluginImports = importLines.filter(
			(l) => !l.includes('@momentumcms/core') && !l.includes('momentum.types'),
		);
		expect(pluginImports).toHaveLength(0);
	});

	it('should handle empty config', () => {
		const config = { collections: [] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('collections: [],');
		expect(output).not.toContain('globals:');
		expect(output).not.toContain('plugins:');
	});

	it('should handle types file in different directory', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, '../../types/src/momentum.types');
		expect(output).toContain('from "../../types/src/momentum.types";');
	});

	it('should strip server-only field properties in inlined collections', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [
						{
							name: 'title',
							type: 'text',
							access: { read: () => true },
							hooks: { beforeChange: [() => ({})] },
							validate: () => true,
						},
					],
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('name: "title"');
		// Count occurrences - access/hooks/validate should not appear in the inlined fields
		expect(output).not.toMatch(/\baccess\b/);
		expect(output).not.toMatch(/\bhooks\b/);
		expect(output).not.toMatch(/\bvalidate\b/);
	});
});

// ============================================
// Component Loader Serialization Tests
// ============================================

describe('generateAdminConfig — component loaders', () => {
	it('should emit global admin.components with rewritten import paths', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			admin: {
				basePath: '/admin',
				components: {
					beforeDashboard: () =>
						import('./app/custom-components/dashboard-banner.component').then(
							(m: Record<string, unknown>) => m['DashboardBannerComponent'],
						),
				},
			},
		};
		const output = generateAdminConfig(
			config,
			'./momentum.types',
			'/project/src/momentum.config.ts',
			'/project/src/generated/momentum.config.ts',
		);
		expect(output).toContain('components:');
		expect(output).toContain('beforeDashboard:');
		// Path should be rewritten from ./app/... to ../app/...
		expect(output).toContain('import("../app/custom-components/dashboard-banner.component")');
	});

	it('should emit per-collection admin.components with rewritten import paths', () => {
		const config = {
			collections: [
				{
					slug: 'articles',
					fields: [{ name: 'title', type: 'text' }],
					admin: {
						group: 'Content',
						components: {
							list: () =>
								import('./app/custom-articles-list.component').then(
									(m: Record<string, unknown>) => m['CustomArticlesListComponent'],
								),
							beforeEdit: () =>
								import('./app/custom-edit-warning.component').then(
									(m: Record<string, unknown>) => m['EditWarningComponent'],
								),
						},
					},
				},
			],
		};
		const output = generateAdminConfig(
			config,
			'./momentum.types',
			'/project/src/momentum.config.ts',
			'/project/src/generated/momentum.config.ts',
		);
		expect(output).toContain('components:');
		expect(output).toContain('list:');
		expect(output).toContain('beforeEdit:');
		expect(output).toContain('import("../app/custom-articles-list.component")');
		expect(output).toContain('import("../app/custom-edit-warning.component")');
		// Non-component admin props should still be emitted
		expect(output).toContain('group: "Content"');
	});

	it('should not emit components when no configPath/outputPath provided', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			admin: {
				basePath: '/admin',
				components: {
					footer: () =>
						import('./app/footer.component').then(
							(m: Record<string, unknown>) => m['FooterComponent'],
						),
				},
			},
		};
		// No configPath/outputPath — backward compatibility
		const output = generateAdminConfig(config, './momentum.types');
		// Should NOT contain the component loaders (paths can't be rewritten)
		expect(output).not.toContain('footer:');
	});

	it('should skip non-function values in components', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [],
					admin: {
						components: {
							stringValue: 'not-a-function',
							loader: () =>
								import('./app/comp.component').then((m: Record<string, unknown>) => m['Comp']),
						},
					},
				},
			],
		};
		const output = generateAdminConfig(
			config,
			'./momentum.types',
			'/project/src/config.ts',
			'/project/src/generated/config.ts',
		);
		expect(output).toContain('loader:');
		expect(output).not.toContain('stringValue');
	});

	it('should handle collection with only components in admin (no other admin props)', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [],
					admin: {
						components: {
							list: () =>
								import('./app/list.component').then(
									(m: Record<string, unknown>) => m['ListComponent'],
								),
						},
					},
				},
			],
		};
		const output = generateAdminConfig(
			config,
			'./momentum.types',
			'/project/src/config.ts',
			'/project/src/generated/config.ts',
		);
		expect(output).toContain('admin:');
		expect(output).toContain('components:');
		expect(output).toContain('list:');
		expect(output).toContain('import("../app/list.component")');
	});

	it('should handle deeply nested paths correctly', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			admin: {
				components: {
					dashboard: () =>
						import('../../shared/components/dashboard.component').then(
							(m: Record<string, unknown>) => m['Dashboard'],
						),
				},
			},
		};
		const output = generateAdminConfig(
			config,
			'./momentum.types',
			'/project/src/app/momentum.config.ts',
			'/project/src/app/generated/momentum.config.ts',
		);
		expect(output).toContain('dashboard:');
		// ../../shared from /project/src/app/ => /project/shared
		// from /project/src/app/generated/ => ../../../shared
		expect(output).toContain('import("../../../shared/components/dashboard.component")');
	});
});

// ============================================
// Security: Component Loader Path Sanitization
// ============================================

describe('security: component loader path sanitization', () => {
	it('should safely escape plugin browserImports path with special characters', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			plugins: [
				{
					name: 'evil-plugin',
					adminRoutes: [{ path: 'evil', loadComponent: () => Promise.resolve({}) }],
					browserImports: {
						adminRoutes: {
							path: "@evil/plugin'); console.log('pwned",
							exportName: 'evilRoutes',
						},
					},
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		// The path must be wrapped in double quotes (JSON.stringify) so single quotes inside are harmless
		// It should NOT produce: from '@evil/plugin'); console.log('pwned';
		// It should produce: from "@evil/plugin'); console.log('pwned";
		expect(output).not.toMatch(/from '@evil/);
		expect(output).toContain('from "@evil/plugin\'); console.log(\'pwned"');
	});

	it('should reject plugin browserImports with malicious exportName', () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			plugins: [
				{
					name: 'evil-plugin',
					adminRoutes: [{ path: 'evil', loadComponent: () => Promise.resolve({}) }],
					browserImports: {
						adminRoutes: {
							path: '@evil/plugin',
							exportName: "evilRoutes } from 'x'; import { eval",
						},
					},
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		// The invalid exportName should be rejected entirely — no import emitted
		expect(output).not.toContain('evilRoutes');
		expect(output).not.toContain('@evil/plugin');
		expect(consoleWarn).toHaveBeenCalled();
		consoleWarn.mockRestore();
	});
});

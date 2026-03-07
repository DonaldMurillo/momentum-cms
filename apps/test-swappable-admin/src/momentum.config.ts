import { defineMomentumConfig } from '@momentumcms/core';
import { postgresAdapter } from '@momentumcms/db-drizzle';
import type { PostgresAdapterWithRaw } from '@momentumcms/db-drizzle';
import { momentumAuth } from '@momentumcms/auth';
import { localStorageAdapter } from '@momentumcms/storage';
import { join } from 'node:path';
import { collections as baseCollections } from '@momentumcms/example-config/collections';
import type { CollectionConfig } from '@momentumcms/core';

/**
 * Override articles collection to add per-collection custom components.
 * Other collections use the built-in defaults.
 */
const collections: CollectionConfig[] = baseCollections.map((c) => {
	if (c.slug === 'articles') {
		return {
			...c,
			admin: {
				...c.admin,
				components: {
					...c.admin?.components,
					// Per-collection page override: custom list
					list: () =>
						import('./app/custom-components/custom-articles-list.component').then(
							(m) => m.CustomArticlesListComponent,
						),
					// Per-collection slots: list
					beforeList: () =>
						import('./app/custom-components/list-before-filter.component').then(
							(m) => m.ListBeforeFilterComponent,
						),
					// Per-collection slots: edit
					beforeEdit: () =>
						import('./app/custom-components/edit-before-warning.component').then(
							(m) => m.EditBeforeWarningComponent,
						),
					editSidebar: () =>
						import('./app/custom-components/edit-sidebar-meta.component').then(
							(m) => m.EditSidebarMetaComponent,
						),
					// Per-collection slots: view
					beforeView: () =>
						import('./app/custom-components/view-before-status.component').then(
							(m) => m.ViewBeforeStatusComponent,
						),
				},
			},
		};
	}
	return c;
});
import { globals } from '@momentumcms/example-config/globals';
import { exampleSeedingConfig } from '@momentumcms/example-config';

/**
 * Database adapter — shared between Momentum and the auth plugin.
 */
const dbAdapter = postgresAdapter({
	connectionString:
		process.env['DATABASE_URL'] ??
		'postgresql://postgres:postgres@localhost:5432/momentum_swappable',
});

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
const pool = (dbAdapter as PostgresAdapterWithRaw).getPool();

const authBaseURL =
	process.env['BETTER_AUTH_URL'] || `http://localhost:${process.env['PORT'] || 4100}`;

/**
 * Auth plugin — manages Better Auth integration, user tables, and middleware.
 */
export const authPlugin = momentumAuth({
	db: { type: 'postgres', pool },
	baseURL: authBaseURL,
	trustedOrigins: ['http://localhost:4200', authBaseURL],
});

/**
 * Momentum CMS configuration for the swappable admin test app.
 *
 * Demonstrates all registration methods for swappable admin components:
 *
 * Config-level slots (admin.components):
 *   beforeDashboard, beforeNavigation, footer
 *
 * Per-collection config (articles.admin.components):
 *   list (page override), beforeList, beforeEdit, editSidebar, beforeView
 *
 * Provider-level registrations are in app.config.ts.
 */
const config = defineMomentumConfig({
	db: { adapter: dbAdapter },
	collections,
	globals,
	storage: {
		adapter: localStorageAdapter({
			directory: join(process.cwd(), 'data', 'uploads'),
		}),
	},
	admin: {
		basePath: '/admin',
		branding: {
			title: 'Swappable Admin Test',
		},
		components: {
			// Config-level slot: banner before dashboard
			beforeDashboard: () =>
				import('./app/custom-components/dashboard-banner.component').then(
					(m) => m.DashboardBannerComponent,
				),
			// Config-level slot: nav widget before navigation
			beforeNavigation: () =>
				import('./app/custom-components/nav-start-widget.component').then(
					(m) => m.NavStartWidgetComponent,
				),
			// Config-level slot: shell footer
			footer: () =>
				import('./app/custom-components/shell-footer.component').then(
					(m) => m.ShellFooterComponent,
				),
			// Note: login slots (beforeLogin/afterLogin) are registered via providers
			// in app.config.ts because the login page renders outside the admin shell.
		},
	},
	server: {
		port: Number(process.env['PORT']) || 4100,
		cors: {
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization', 'X-API-Key'],
		},
	},
	logging: {
		level: 'debug',
		format: 'pretty',
	},
	plugins: [authPlugin],
	seeding: exampleSeedingConfig,
});

export default config;

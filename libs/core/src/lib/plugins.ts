/**
 * Plugin System Type Definitions
 *
 * Canonical type definitions for the Momentum CMS plugin system.
 * These live in @momentumcms/core to avoid circular dependencies.
 * Runtime implementations (PluginRunner, etc.) live in @momentumcms/plugins/core.
 */

import type { CollectionConfig } from './collections';
import type { MomentumConfig } from './config';

/**
 * Descriptor for Express middleware/routes that a plugin wants auto-mounted.
 * Plugins register these during onInit via context.registerMiddleware().
 * The framework mounts them automatically in momentumApiMiddleware().
 */
export interface PluginMiddlewareDescriptor {
	/** Mount path relative to the API root (e.g. '/analytics/collect', '/') */
	path: string;
	/** Express Router or middleware function. Typed as unknown to avoid Express dependency in core. */
	handler: unknown;
	/**
	 * Where to mount relative to collection CRUD routes.
	 * - 'before-api': Before collection CRUD routes (under /api)
	 * - 'after-api': After collection CRUD routes (under /api)
	 * - 'root': Mounted at the application root (not under /api)
	 * @default 'before-api'
	 */
	position?: 'before-api' | 'after-api' | 'root';
}

/**
 * Descriptor for Angular DI providers that a plugin wants auto-registered during SSR.
 * Plugins register these during onInit via context.registerProvider().
 * The framework exposes them via getPluginProviders() for Angular SSR injection.
 */
export interface PluginProviderDescriptor {
	/** Provider name (for debugging/logging) */
	name: string;
	/** The InjectionToken. Typed as unknown to avoid Angular dependency in core. */
	token: unknown;
	/** The value to provide */
	value: unknown;
}

/**
 * Descriptor for an admin UI route that a plugin wants to register.
 * Plugins can declare these statically on the plugin object via `adminRoutes`,
 * or register them during onInit via context.registerAdminRoute().
 *
 * The framework mounts them as lazy-loaded Angular routes inside the admin shell
 * and renders corresponding sidebar navigation items.
 *
 * Mirrors Angular Route concepts (path, loadComponent, data) with
 * additional Momentum sidebar metadata (label, icon, group).
 */
export interface PluginAdminRouteDescriptor {
	/** Route path under admin (e.g., 'analytics') -- same as Angular Route.path */
	path: string;
	/** Lazy-loaded component -- same concept as Angular Route.loadComponent.
	 *  Typed as unknown to avoid Angular dependency in core. */
	loadComponent: unknown;
	/** Optional route data -- same concept as Angular Route.data */
	data?: Record<string, unknown>;
	/** Sidebar display label */
	label: string;
	/** Icon name from ng-icons (e.g., 'heroChartBarSquare') */
	icon: string;
	/** Sidebar section name. @default 'Plugins' */
	group?: string;
}

/**
 * Collection event types that plugins can listen to.
 */
export type CollectionEventType =
	| 'beforeChange'
	| 'afterChange'
	| 'beforeDelete'
	| 'afterDelete'
	| 'beforeRead'
	| 'afterRead';

/**
 * A collection event emitted by the hook system.
 */
export interface CollectionEvent {
	/** The collection slug */
	collection: string;
	/** The event type */
	event: CollectionEventType;
	/** The operation (create/update/delete/softDelete/restore) */
	operation?: 'create' | 'update' | 'delete' | 'softDelete' | 'restore';
	/** The document data (after operation) */
	doc?: Record<string, unknown>;
	/** The document data before the operation */
	previousDoc?: Record<string, unknown>;
	/** ISO timestamp of the event */
	timestamp: string;
}

/** Logger interface for plugins (avoids importing @momentumcms/logger in core) */
export interface PluginLogger {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

/**
 * Context available to plugins during onInit.
 * Collections are mutable -- plugins can inject hooks here.
 */
export interface PluginContext {
	/** The full Momentum config */
	config: MomentumConfig;
	/** Mutable collections array -- plugins can add hooks */
	collections: CollectionConfig[];
	/** Logger scoped to the plugin name */
	logger: PluginLogger;
	/** Register Express middleware/routes to be auto-mounted by the framework */
	registerMiddleware(descriptor: PluginMiddlewareDescriptor): void;
	/** Register Angular providers for SSR (available to admin UI during server rendering) */
	registerProvider(descriptor: PluginProviderDescriptor): void;
}

/**
 * Extended context available during onReady.
 * The API is fully initialized at this point.
 */
export interface PluginReadyContext extends PluginContext {
	/** The initialized Momentum API singleton */
	api: MomentumAPI;
}

/**
 * Minimal MomentumAPI interface to avoid circular dependencies.
 * The real MomentumAPI from server-core is structurally compatible.
 * Plugins that need full typing can import from @momentumcms/server-core.
 */
export interface MomentumAPI {
	/** Get operations for a specific collection */
	collection(slug: string): unknown;
	/** Get the current config */
	getConfig(): MomentumConfig;
}

/**
 * A Momentum CMS plugin.
 *
 * Plugins participate in the server lifecycle:
 * - `onInit`: Before API initialization. Inject hooks into collections here.
 * - `onReady`: After API + seeding. The API is ready for queries.
 * - `onShutdown`: Graceful shutdown. Clean up resources.
 *
 * Plugins can declare admin routes statically via `adminRoutes`.
 * These are read at config time by `momentumAdminRoutes(config)` to generate
 * Angular routes without any manual wiring.
 *
 * @example
 * ```typescript
 * const myPlugin: MomentumPlugin = {
 *   name: 'my-plugin',
 *   adminRoutes: [{
 *     path: 'my-page',
 *     label: 'My Page',
 *     icon: 'heroCog6Tooth',
 *     loadComponent: () => import('./my-page').then(m => m.MyPage),
 *   }],
 *   async onInit({ collections, logger }) {
 *     logger.info('Initializing...');
 *   },
 * };
 * ```
 */
export interface MomentumPlugin {
	/** Unique plugin name */
	name: string;

	/** Static collections declared by this plugin.
	 *  Read at config time by `momentumAdminRoutes(config)` to include
	 *  plugin collections in the admin UI route data.
	 *  Plugins should still push collections in `onInit` for server-side
	 *  schema generation and API registration. */
	collections?: CollectionConfig[];

	/** Static admin routes declared by this plugin.
	 *  Read at config time — no async needed. */
	adminRoutes?: PluginAdminRouteDescriptor[];

	/** Synchronously transform the merged collections at config time.
	 *  Called by `momentumAdminRoutes()` so the admin UI reflects plugin modifications
	 *  (e.g., injected fields). Also called during server-side `initializeMomentum()`.
	 *  Must be idempotent — may be called more than once. */
	modifyCollections?(collections: CollectionConfig[]): void;

	/** Called before API initialization. Inject hooks here. */
	onInit?(context: PluginContext): void | Promise<void>;

	/** Called after API + seeding complete. API is ready for queries. */
	onReady?(context: PluginReadyContext): void | Promise<void>;

	/** Called on graceful shutdown. Clean up resources. */
	onShutdown?(context: PluginContext): void | Promise<void>;

	/** Browser-safe import descriptors for the admin config generator.
	 *  Tells the generator where to import collections, admin routes, and
	 *  modifyCollections from browser-safe sub-paths instead of the main
	 *  server-only entry point. */
	browserImports?: PluginBrowserImports;
}

/** A single browser-safe import descriptor for a plugin export. */
export interface PluginBrowserImport {
	/** The import path (e.g., '@momentumcms/auth/collections') */
	path: string;
	/** The named export to import (e.g., 'BASE_AUTH_COLLECTIONS') */
	exportName: string;
}

/** Browser-safe import map for the admin config generator.
 *  Plugins declare which sub-paths expose browser-safe versions
 *  of their collections, admin routes, and modifyCollections. */
export interface PluginBrowserImports {
	/** Import path for browser-safe plugin collections */
	collections?: PluginBrowserImport;
	/** Import path for browser-safe plugin admin routes */
	adminRoutes?: PluginBrowserImport;
	/** Import path for browser-safe modifyCollections function */
	modifyCollections?: PluginBrowserImport;
}

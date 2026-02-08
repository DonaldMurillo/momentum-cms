/**
 * Plugin System Types
 *
 * Defines the interfaces for Momentum CMS plugins.
 * Plugins can hook into the server lifecycle and inject collection hooks.
 */

import type { CollectionConfig, MomentumConfig } from '@momentum-cms/core';
import type { MomentumLogger } from '@momentum-cms/logger';

/**
 * Descriptor for Express middleware/routes that a plugin wants auto-mounted.
 * Plugins register these during onInit via context.registerMiddleware().
 * The framework mounts them automatically in momentumApiMiddleware().
 */
export interface PluginMiddlewareDescriptor {
	/** Mount path relative to the API root (e.g. '/analytics/collect', '/') */
	path: string;
	/** Express Router or middleware function. Typed as unknown to avoid Express dependency in plugins lib. */
	handler: unknown;
	/** Where to mount relative to collection CRUD routes. @default 'before-api' */
	position?: 'before-api' | 'after-api';
}

/**
 * Descriptor for Angular DI providers that a plugin wants auto-registered during SSR.
 * Plugins register these during onInit via context.registerProvider().
 * The framework exposes them via getPluginProviders() for Angular SSR injection.
 */
export interface PluginProviderDescriptor {
	/** Provider name (for debugging/logging) */
	name: string;
	/** The InjectionToken. Typed as unknown to avoid Angular dependency in plugins lib. */
	token: unknown;
	/** The value to provide */
	value: unknown;
}

/**
 * Descriptor for an admin UI route that a plugin wants to register.
 * Plugins register these during onInit via context.registerAdminRoute().
 * The framework mounts them as lazy-loaded Angular routes inside the admin shell
 * and renders corresponding sidebar navigation items.
 *
 * Mirrors Angular Route concepts (path, loadComponent, data) with
 * additional Momentum sidebar metadata (label, icon, group).
 */
export interface PluginAdminRouteDescriptor {
	/** Route path under admin (e.g., 'analytics') — same as Angular Route.path */
	path: string;
	/** Lazy-loaded component — same concept as Angular Route.loadComponent.
	 *  Typed as unknown to avoid Angular dependency in plugins lib. */
	loadComponent: unknown;
	/** Optional route data — same concept as Angular Route.data */
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
	/** The operation (create/update/delete) */
	operation?: 'create' | 'update' | 'delete';
	/** The document data (after operation) */
	doc?: Record<string, unknown>;
	/** The document data before the operation */
	previousDoc?: Record<string, unknown>;
	/** ISO timestamp of the event */
	timestamp: string;
}

/**
 * Context available to plugins during onInit.
 * Collections are mutable — plugins can inject hooks here.
 */
export interface PluginContext {
	/** The full Momentum config */
	config: MomentumConfig;
	/** Mutable collections array — plugins can add hooks */
	collections: CollectionConfig[];
	/** Logger scoped to the plugin name */
	logger: MomentumLogger;
	/** Register Express middleware/routes to be auto-mounted by the framework */
	registerMiddleware(descriptor: PluginMiddlewareDescriptor): void;
	/** Register Angular providers for SSR (available to admin UI during server rendering) */
	registerProvider(descriptor: PluginProviderDescriptor): void;
	/** Register an admin UI route with sidebar navigation */
	registerAdminRoute(descriptor: PluginAdminRouteDescriptor): void;
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
 * Plugins that need full typing can import from @momentum-cms/server-core.
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
 * @example
 * ```typescript
 * const myPlugin: MomentumPlugin = {
 *   name: 'my-plugin',
 *   async onInit({ collections, logger }) {
 *     logger.info('Initializing...');
 *     // Inject hooks into collections
 *   },
 *   async onReady({ api, logger }) {
 *     logger.info('Ready!');
 *   },
 *   async onShutdown({ logger }) {
 *     logger.info('Shutting down...');
 *   },
 * };
 * ```
 */
export interface MomentumPlugin {
	/** Unique plugin name */
	name: string;

	/** Called before API initialization. Inject hooks here. */
	onInit?(context: PluginContext): void | Promise<void>;

	/** Called after API + seeding complete. API is ready for queries. */
	onReady?(context: PluginReadyContext): void | Promise<void>;

	/** Called on graceful shutdown. Clean up resources. */
	onShutdown?(context: PluginContext): void | Promise<void>;
}

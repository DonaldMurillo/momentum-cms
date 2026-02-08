/**
 * Plugin Middleware Registry
 *
 * Module-level singleton that bridges plugin initialization and middleware mounting.
 * Same pattern as getMomentumAPI()/initializeMomentumAPI() in server-core.
 *
 * Flow:
 * 1. initializeMomentum() runs pluginRunner.runInit() — plugins register middleware/providers
 * 2. initializeMomentum() calls setPluginMiddleware/setPluginProviders to store them
 * 3. momentumApiMiddleware() calls getPluginMiddleware() to auto-mount them
 * 4. server.ts calls getPluginProviders() to spread into Angular SSR
 */

import type {
	PluginMiddlewareDescriptor,
	PluginProviderDescriptor,
	PluginAdminRouteDescriptor,
} from '@momentum-cms/plugins';

let pluginMiddleware: PluginMiddlewareDescriptor[] = [];
let pluginProviders: PluginProviderDescriptor[] = [];
let pluginAdminRoutes: PluginAdminRouteDescriptor[] = [];

/**
 * Store plugin middleware descriptors collected during onInit.
 * Called by initializeMomentum() after pluginRunner.runInit().
 */
export function setPluginMiddleware(middleware: PluginMiddlewareDescriptor[]): void {
	pluginMiddleware = middleware;
}

/**
 * Get plugin middleware descriptors for auto-mounting.
 * Called by momentumApiMiddleware() to mount plugin routes/middleware.
 */
export function getPluginMiddleware(): PluginMiddlewareDescriptor[] {
	return pluginMiddleware;
}

/**
 * Store plugin provider descriptors collected during onInit.
 * Called by initializeMomentum() after pluginRunner.runInit().
 */
export function setPluginProviders(providers: PluginProviderDescriptor[]): void {
	pluginProviders = providers;
}

/**
 * Get plugin provider descriptors for Angular SSR injection.
 * Called by server.ts to spread into angularApp.handle() providers.
 *
 * @example
 * ```typescript
 * import { getPluginProviders } from '@momentum-cms/server-express';
 *
 * angularApp.handle(req, {
 *   providers: [
 *     ...provideMomentumAPI(api, { user }),
 *     ...getPluginProviders().map(p => ({ provide: p.token, useValue: p.value })),
 *   ],
 * });
 * ```
 */
export function getPluginProviders(): PluginProviderDescriptor[] {
	return pluginProviders;
}

/**
 * Store plugin admin route descriptors collected during onInit.
 * Called by initializeMomentum() after pluginRunner.runInit().
 */
export function setPluginAdminRoutes(routes: PluginAdminRouteDescriptor[]): void {
	pluginAdminRoutes = routes;
}

/**
 * Get plugin admin route descriptors for Angular admin UI.
 * Called by app routing to generate admin child routes and sidebar nav items.
 */
export function getPluginAdminRoutes(): PluginAdminRouteDescriptor[] {
	return pluginAdminRoutes;
}

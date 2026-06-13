/**
 * Consolidated Momentum CMS server factory for Express.
 *
 * Replaces the manual orchestration of 12+ separate functions
 * with a single `createMomentumServer()` call that handles:
 * - Express app creation with JSON parsing
 * - Plugin initialization (auth, analytics, event bus, etc.)
 * - Database schema + API initialization
 * - Seeding
 * - Webhook hooks registration
 * - Health endpoint
 * - Session resolver middleware
 * - OpenAPI docs endpoint
 * - CMS API endpoints
 * - Publish scheduler
 * - SSR provider helpers
 */

import express, { type Express, type RequestHandler } from 'express';
import type { MomentumConfig, ResolvedMomentumConfig } from '@momentumcms/core';
import type { Provider } from '@angular/core';
import {
	getMomentumAPI,
	registerWebhookHooks,
	startPublishScheduler,
	type PublishSchedulerHandle,
} from '@momentumcms/server-core';
import {
	initializeMomentum,
	createHealthMiddleware,
	type MomentumInitResult,
} from './init-helpers';
import { createDeferredSessionResolver } from './auth-middleware';
import { getPluginMiddleware, getPluginProviders } from './plugin-middleware-registry';
import {
	momentumApiMiddleware,
	createOpenAPIMiddleware,
	sanitizedJsonErrorHandler,
} from './server-express';
import type { MomentumAuthPlugin } from '@momentumcms/auth';

/**
 * Options for creating a consolidated Momentum CMS Express server.
 */
export interface CreateMomentumServerOptions {
	/** Fully resolved Momentum configuration */
	config: MomentumConfig | ResolvedMomentumConfig;

	/**
	 * Custom Express app instance.
	 * If not provided, a new Express app is created with `express.json()` body parser.
	 */
	app?: Express;

	/**
	 * Mount health endpoint at /api/health.
	 * @default true
	 */
	health?: boolean;

	/**
	 * Mount OpenAPI/Swagger docs at /api/docs.
	 * @default false
	 */
	openapi?: boolean;

	/**
	 * Start publish scheduler for scheduled content.
	 * Pass `true` for default interval (10s) or an object with custom intervalMs.
	 * @default false
	 */
	publishScheduler?: boolean | { intervalMs: number };

	/**
	 * Register webhook hooks on collections.
	 * @default true (if any collection has webhook config)
	 */
	webhooks?: boolean;

	/**
	 * Auth plugin instance for session resolution.
	 * If not provided, auto-detected from config.plugins.
	 */
	authPlugin?: MomentumAuthPlugin;

	/**
	 * Factory to create SSR providers for the Momentum API.
	 * Receives the API singleton and user context; should return Angular Providers.
	 *
	 * Typically: `(api, ctx) => provideMomentumAPI(api, ctx)` from `@momentumcms/admin`.
	 * If not provided, `getSsrProviders()` returns only plugin providers.
	 */
	providerFactory?: (
		api: unknown,
		context: { user?: { id: string; email: string; role: string } },
	) => Provider[];
}

/**
 * Result of creating a Momentum CMS server.
 */
/**
 * Apply slow-client mitigations to a Node http.Server returned by
 * `app.listen()`.
 *
 * Defaults:
 *  - `requestTimeout` 30s (full request must arrive within this window)
 *  - `headersTimeout` 10s (headers must arrive faster than requestTimeout)
 *  - `keepAliveTimeout` 5s
 *
 * These complement Express middleware: Slowloris attacks that trickle bytes
 * to keep a TCP connection open are killed at the http layer.
 *
 * Override individual values via the `overrides` argument.
 */
export function configureHttpServerTimeouts(
	server: { requestTimeout?: number; headersTimeout?: number; keepAliveTimeout?: number },
	overrides: Partial<{
		requestTimeout: number;
		headersTimeout: number;
		keepAliveTimeout: number;
	}> = {},
): void {
	server.requestTimeout = overrides.requestTimeout ?? 30_000;
	server.headersTimeout = overrides.headersTimeout ?? 10_000;
	server.keepAliveTimeout = overrides.keepAliveTimeout ?? 5_000;
}

export interface MomentumServer {
	/**
	 * Express app with all CMS middleware mounted.
	 * Mount additional routes (static files, SSR handler) on this app.
	 */
	app: Express;

	/**
	 * Initialization result with ready promise and seeding status.
	 */
	init: MomentumInitResult;

	/**
	 * Session resolver middleware.
	 * Mount this before your Angular/framework SSR handler so that
	 * `req.user` is populated for access-controlled SSR rendering.
	 */
	sessionResolver: RequestHandler;

	/**
	 * Get Angular SSR providers for the current request.
	 * Includes the Momentum API singleton and all plugin providers.
	 *
	 * @param user - The authenticated user from `req.user` (set by sessionResolver)
	 */
	getSsrProviders(user?: { id: string; email: string; role: string }): Provider[];

	/**
	 * Graceful shutdown: stops publish scheduler and plugin runners.
	 */
	shutdown(): Promise<void>;
}

/**
 * Create a fully configured Momentum CMS Express server with a single function call.
 *
 * Consolidates initialization, middleware mounting, and plugin wiring that previously
 * required 12+ separate function calls orchestrated in a specific order.
 *
 * @example
 * ```typescript
 * import { createMomentumServer } from '@momentumcms/server-express';
 * import config from './momentum.config';
 *
 * const server = await createMomentumServer({
 *   config,
 *   health: true,
 *   openapi: true,
 *   publishScheduler: { intervalMs: 2000 },
 * });
 *
 * // Add app-specific routes (static files, SSR)
 * server.app.use(express.static(browserDistFolder, { maxAge: '1y' }));
 * server.app.use(server.sessionResolver);
 * server.app.use('/**', (req, res, next) => {
 *   angularApp.handle(req, { providers: server.getSsrProviders(req.user) })...
 * });
 *
 * server.app.listen(4000);
 * ```
 */
export async function createMomentumServer(
	options: CreateMomentumServerOptions,
): Promise<MomentumServer> {
	const {
		config,
		health = true,
		openapi = false,
		publishScheduler = false,
		webhooks = true,
		providerFactory,
	} = options;

	// 1. Create or reuse Express app
	const app = options.app ?? express();
	if (!options.app) {
		// Scope JSON body parser to /api/* so non-API requests don't have their
		// streams consumed. Without this scoping, requests that fall through to
		// the SSR handler (e.g. `/api/some/unknown/path`) crash with
		// "Response body object should not be disturbed or locked" because the
		// SSR layer tries to construct a `Request` from a stream the parser
		// already drained. Found by the workflow chaos audit.
		//
		// 10mb accommodates import-export batch payloads (MAX_IMPORT_DOCS=5000).
		// Most routes don't need anywhere near this — `express.json` with a
		// 10mb cap is acceptable because the import-export handler does its
		// own row-count cap, but the parser stops earlier on malformed input.
		app.use('/api', express.json({ limit: '10mb' }));
		// Sanitize body-parser errors (SyntaxError, charset, payload-too-large)
		// to JSON envelopes BEFORE they fall through to the SSR handler's
		// default HTML stack-trace page. Scoped to /api/* — non-API errors
		// still propagate to the framework's default handler.
		app.use('/api', sanitizedJsonErrorHandler);
	}

	// 2. Register webhook hooks
	if (webhooks) {
		registerWebhookHooks(config.collections);
	}

	// 3. Initialize Momentum CMS (plugins, DB schema, API, seeding)
	const init = initializeMomentum(config);
	await init.ready;

	// 4. Start publish scheduler if requested
	let schedulerHandle: PublishSchedulerHandle | undefined;
	if (publishScheduler) {
		const schedulerOpts = typeof publishScheduler === 'object' ? publishScheduler : undefined;
		schedulerHandle = startPublishScheduler(config.db.adapter, config.collections, schedulerOpts);
	}

	// 5. Mount health endpoint
	if (health) {
		app.use(
			'/api/health',
			createHealthMiddleware({
				isReady: init.isReady,
				getSeedingStatus: init.getSeedingStatus,
				waitForReady: init.ready,
			}),
		);
	}

	// 6. Auto-detect auth plugin for session resolution
	let authPlugin = options.authPlugin;
	if (!authPlugin) {
		for (const plugin of config.plugins ?? []) {
			if ('getAuth' in plugin && typeof plugin.getAuth === 'function') {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Plugin type narrowing
				authPlugin = plugin as MomentumAuthPlugin;
				break;
			}
		}
	}

	// 7. Create session resolver (always available, even without auth — becomes a noop)
	const sessionResolver: RequestHandler = authPlugin
		? createDeferredSessionResolver(authPlugin)
		: (_req, _res, next) => next();

	// 8. Mount session resolver BEFORE CMS API so req.user is available for access control
	app.use(sessionResolver);

	// 9. Mount OpenAPI docs
	if (openapi) {
		app.use('/api/docs', createOpenAPIMiddleware({ config }));
	}

	// 10. Mount root-level plugin middleware (e.g. /sitemap.xml, /robots.txt)
	// These are mounted directly on the app, NOT under /api, because external
	// consumers (search engine crawlers) expect them at the domain root.
	const rootMiddleware = getPluginMiddleware().filter((mw) => mw.position === 'root');
	for (const mw of rootMiddleware) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler is Express Router/middleware
		app.use(mw.path, mw.handler as import('express').Router);
	}

	// 11. Mount CMS API endpoints
	app.use('/api', momentumApiMiddleware(config));

	// 12. SSR provider helper
	function getSsrProviders(user?: { id: string; email: string; role: string }): Provider[] {
		const pluginProviders = getPluginProviders().map((p) => ({
			provide: p.token,
			useValue: p.value,
		}));
		if (providerFactory) {
			return [...providerFactory(getMomentumAPI(), { user }), ...pluginProviders];
		}
		return pluginProviders;
	}

	// 13. Shutdown handler
	async function shutdown(): Promise<void> {
		schedulerHandle?.stop();
		await init.shutdown();
	}

	return {
		app,
		init,
		sessionResolver,
		getSsrProviders,
		shutdown,
	};
}

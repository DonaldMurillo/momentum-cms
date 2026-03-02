import { NestFactory } from '@nestjs/core';
import { Module, type INestApplication } from '@nestjs/common';
import type { Express, RequestHandler } from 'express';
import type { MomentumConfig, ResolvedMomentumConfig } from '@momentumcms/core';
import {
	getMomentumAPI,
	registerWebhookHooks,
	startPublishScheduler,
	type PublishSchedulerHandle,
} from '@momentumcms/server-core';
import {
	initializeMomentum,
	createHealthMiddleware,
	momentumApiMiddleware,
	createDeferredSessionResolver,
	getPluginMiddleware,
	getPluginProviders,
	type MomentumInitResult,
} from '@momentumcms/server-express';
import type { MomentumAuthPlugin } from '@momentumcms/auth';
import type { PluginMiddlewareDescriptor } from '@momentumcms/plugins/core';
import { MomentumModule } from './momentum.module';

/**
 * Options for creating a Momentum CMS NestJS server.
 */
export interface CreateMomentumNestServerOptions {
	/** Momentum CMS configuration */
	config: MomentumConfig | ResolvedMomentumConfig;

	/** API route prefix. @default 'api' */
	prefix?: string;

	/**
	 * Mount health endpoint at /{prefix}/health.
	 * @default true
	 */
	health?: boolean;

	/**
	 * Start publish scheduler for scheduled content.
	 * Pass `true` for default interval (10s) or an object with custom intervalMs.
	 * @default false
	 */
	publishScheduler?: boolean | { intervalMs: number };

	/**
	 * Register webhook hooks on collections.
	 * @default true
	 */
	webhooks?: boolean;

	/**
	 * Auth plugin instance for session resolution.
	 * If not provided, auto-detected from config.plugins.
	 */
	authPlugin?: MomentumAuthPlugin;

	/**
	 * Factory to create SSR providers for the Momentum API.
	 * Receives the API singleton and user context; should return framework Providers.
	 *
	 * Typically: `(api, ctx) => provideMomentumAPI(api, ctx)` from `@momentumcms/admin`.
	 * If not provided, `getSsrProviders()` returns only plugin providers.
	 */
	providerFactory?: (
		api: unknown,
		context: { user?: { id: string; email: string; role: string } },
	) => unknown[];
}

/**
 * Result of creating a Momentum CMS NestJS server.
 */
export interface MomentumNestServer {
	/** The NestJS application instance */
	app: INestApplication;

	/** Initialization result with ready promise and seeding status */
	init: MomentumInitResult;

	/**
	 * Session resolver middleware.
	 * Mount this before your Angular/framework SSR handler so that
	 * `req.user` is populated for access-controlled SSR rendering.
	 */
	sessionResolver: RequestHandler;

	/**
	 * Get SSR providers for the current request.
	 * Includes all plugin providers (analytics, etc.).
	 */
	getSsrProviders(user?: { id: string; email: string; role: string }): unknown[];

	/** Graceful shutdown */
	shutdown: () => Promise<void>;
}

/**
 * Create a fully configured Momentum CMS NestJS server.
 *
 * Handles:
 * - Plugin lifecycle (onInit → onReady → onShutdown) via initializeMomentum()
 * - Database schema initialization
 * - Auth, setup, and API key middleware
 * - Health endpoint with ?checkSeeds=true support
 * - All CMS API routes (CRUD, versions, publish, batch, search, etc.)
 * - Session resolver for Angular SSR
 * - Publish scheduler (optional)
 * - NestJS app lifecycle management
 *
 * @example
 * ```typescript
 * import { createMomentumNestServer } from '@momentumcms/server-nestjs';
 * import config from './momentum.config';
 *
 * const server = await createMomentumNestServer({ config });
 *
 * // Get underlying Express for static files + SSR
 * const expressApp = server.app.getHttpAdapter().getInstance();
 * expressApp.use(express.static(browserDistFolder));
 * expressApp.use(server.sessionResolver);
 * expressApp.use((req, res, next) => {
 *   angularApp.handle(req, { providers: server.getSsrProviders(req.user) })...
 * });
 *
 * await server.app.listen(4000);
 * ```
 */
export async function createMomentumNestServer(
	options: CreateMomentumNestServerOptions,
): Promise<MomentumNestServer> {
	const {
		config,
		prefix = 'api',
		health = true,
		publishScheduler = false,
		webhooks = true,
	} = options;

	// 1. Register webhook hooks
	if (webhooks) {
		registerWebhookHooks(config.collections);
	}

	// 2. Initialize Momentum CMS (logger, plugins, DB schema, API, seeding)
	// This also auto-detects auth plugin and registers auth/setup/API-key middleware
	const init = initializeMomentum(config);
	await init.ready;

	// 3. Start publish scheduler if requested
	let schedulerHandle: PublishSchedulerHandle | undefined;
	if (publishScheduler) {
		const schedulerOpts = typeof publishScheduler === 'object' ? publishScheduler : undefined;
		schedulerHandle = startPublishScheduler(config.db.adapter, config.collections, schedulerOpts);
	}

	// 4. Create NestJS app (minimal module — API routes handled by Express middleware)
	@Module({
		imports: [MomentumModule.forRoot(config)],
	})
	class AppModule {}

	const app = await NestFactory.create(AppModule, { logger: false });

	// 5. Get underlying Express instance BEFORE app.init().
	// Middleware mounted here runs BEFORE NestJS's route handlers,
	// which are registered during app.init().
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- NestJS Express adapter returns Express instance
	const expressApp = app.getHttpAdapter().getInstance() as Express;

	// 6. Mount health endpoint (with ?checkSeeds=true support for E2E infrastructure)
	if (health) {
		expressApp.use(
			`/${prefix}/health`,
			createHealthMiddleware({
				isReady: init.isReady,
				getSeedingStatus: init.getSeedingStatus,
				waitForReady: init.ready,
			}),
		);
	}

	// 7. Auto-detect auth plugin for session resolution
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

	// 8. Create session resolver (always available, even without auth — becomes a noop)
	const sessionResolver: RequestHandler = authPlugin
		? createDeferredSessionResolver(authPlugin)
		: (_req, _res, next) => next();

	// 9. Mount session resolver BEFORE CMS API so req.user is available for access control
	expressApp.use(sessionResolver);

	// 10. Mount root-level plugin middleware (e.g. /sitemap.xml, /robots.txt)
	const rootMiddleware = getPluginMiddleware().filter(
		(mw: PluginMiddlewareDescriptor) => mw.position === 'root',
	);
	for (const mw of rootMiddleware) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler is Express Router/middleware
		expressApp.use(mw.path, mw.handler as import('express').Router);
	}

	// 11. Mount ALL CMS API routes (CRUD, versions, publish, batch, search,
	//     GraphQL, file upload, import/export, OpenAPI, etc.)
	expressApp.use(`/${prefix}`, momentumApiMiddleware(config));

	// 12. Now initialize NestJS (registers its own routes AFTER our middleware)
	await app.init();

	// 13. SSR provider helper
	function getSsrProviders(user?: { id: string; email: string; role: string }): unknown[] {
		const pluginProviderList = getPluginProviders().map((p) => ({
			provide: p.token,
			useValue: p.value,
		}));
		if (options.providerFactory) {
			return [...options.providerFactory(getMomentumAPI(), { user }), ...pluginProviderList];
		}
		return pluginProviderList;
	}

	// 14. Shutdown handler
	async function shutdown(): Promise<void> {
		schedulerHandle?.stop();
		await init.shutdown();
		await app.close();
	}

	return {
		app,
		init,
		sessionResolver,
		getSsrProviders,
		shutdown,
	};
}

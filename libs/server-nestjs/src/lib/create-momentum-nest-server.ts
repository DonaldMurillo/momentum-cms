import { NestFactory } from '@nestjs/core';
import { Module, type INestApplication } from '@nestjs/common';
import type { MomentumConfig } from '@momentumcms/core';
import {
	initializeMomentumAPI,
	isMomentumAPIInitialized,
	registerWebhookHooks,
	runSeeding,
	shouldRunSeeding,
} from '@momentumcms/server-core';
import { initializeMomentumLogger } from '@momentumcms/logger';
import { PluginRunner } from '@momentumcms/plugins/core';
import { MomentumModule } from './momentum.module';

/**
 * Options for creating a Momentum CMS NestJS server.
 */
export interface CreateMomentumNestServerOptions {
	/** Momentum CMS configuration */
	config: MomentumConfig;

	/** API route prefix. @default 'api' */
	prefix?: string;
}

/**
 * Result of creating a Momentum CMS NestJS server.
 */
export interface MomentumNestServer {
	/** The NestJS application instance */
	app: INestApplication;

	/** Graceful shutdown */
	shutdown: () => Promise<void>;
}

/**
 * Create a fully configured Momentum CMS NestJS server.
 *
 * Handles:
 * - Plugin lifecycle (onInit → onReady → onShutdown)
 * - Database schema initialization
 * - NestJS app creation with MomentumModule
 * - API initialization
 * - Seeding (if configured)
 * - Route prefix setup
 *
 * @example
 * ```typescript
 * import { createMomentumNestServer } from '@momentumcms/server-nestjs';
 * import config from './momentum.config';
 *
 * const server = await createMomentumNestServer({ config });
 * await server.app.listen(4000);
 * ```
 */
export async function createMomentumNestServer(
	options: CreateMomentumNestServerOptions,
): Promise<MomentumNestServer> {
	const { config, prefix = 'api' } = options;

	// Initialize logger from config (must be first)
	const loggingConfig = 'logging' in config && config.logging ? config.logging : undefined;
	initializeMomentumLogger(loggingConfig);

	// Initialize plugins (onInit phase — plugins inject collection hooks, etc.)
	const plugins = config.plugins ?? [];
	const pluginRunner = new PluginRunner({
		config,
		collections: config.collections,
		plugins,
	});

	if (plugins.length > 0) {
		await pluginRunner.runInit();
	}

	// Initialize database schema if adapter supports it
	if (config.db.adapter.initialize) {
		await config.db.adapter.initialize(config.collections);
	}

	// Initialize globals if configured
	if (config.db.adapter.initializeGlobals && config.globals?.length) {
		await config.db.adapter.initializeGlobals(config.globals);
	}

	// Initialize the API singleton
	let api;
	if (!isMomentumAPIInitialized()) {
		api = initializeMomentumAPI(config);
	}

	// Register webhook hooks
	registerWebhookHooks(config.collections);

	// Run seeding if configured
	const runOnStart = config.seeding?.options?.runOnStart ?? 'development';
	if (config.seeding && shouldRunSeeding(runOnStart)) {
		await runSeeding(config.seeding, config.db.adapter);
	}

	// Notify plugins: ready (API + seeding complete)
	if (plugins.length > 0 && api) {
		await pluginRunner.runReady(api);
	}

	// Create a root module that imports MomentumModule
	@Module({
		imports: [MomentumModule.forRoot(config)],
	})
	class AppModule {}

	const app = await NestFactory.create(AppModule, { logger: false });
	app.setGlobalPrefix(prefix);
	await app.init();

	return {
		app,
		shutdown: async () => {
			await pluginRunner.runShutdown();
			await app.close();
		},
	};
}

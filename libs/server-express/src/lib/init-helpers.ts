import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import {
	initializeMomentumAPI,
	runSeeding,
	shouldRunSeeding,
	type SeedingResult,
	type MomentumAuthLike,
} from '@momentum-cms/server-core';
import type { MomentumConfig, ResolvedMomentumConfig } from '@momentum-cms/core';
import { initializeMomentumLogger, createLogger } from '@momentum-cms/logger';
import { PluginRunner } from '@momentum-cms/plugins/core';
import { setPluginMiddleware, setPluginProviders } from './plugin-middleware-registry';

/**
 * Result of initializing Momentum CMS.
 */
export interface MomentumInitResult {
	/**
	 * Promise that resolves when initialization (including seeding) completes.
	 * Use this to wait for full initialization before accepting requests.
	 */
	ready: Promise<void>;

	/**
	 * Seeding result if seeding was run, null otherwise.
	 */
	seedingResult: SeedingResult | null;

	/**
	 * Whether initialization has completed.
	 */
	isReady: () => boolean;

	/**
	 * Get current seeding status for health checks.
	 */
	getSeedingStatus: () => SeedingStatus;

	/**
	 * Gracefully shut down all plugins.
	 * Call this when the server is stopping.
	 */
	shutdown: () => Promise<void>;
}

/**
 * Seeding status for health endpoint.
 */
export interface SeedingStatus {
	/** Number of seeds that were processed */
	completed: number;
	/** Total number of seeds expected */
	expected: number;
	/** Whether seeding has completed */
	ready: boolean;
}

/**
 * Options for initializeMomentum.
 */
export interface InitializeMomentumOptions {
	/**
	 * Whether to log initialization progress.
	 * @default true
	 */
	logging?: boolean;

	/**
	 * Custom logger function.
	 * @default console.log
	 */
	logger?: (message: string) => void;

	/**
	 * Auth instance for auth-aware user seeding.
	 * When provided, seeds created with `authUser()` will automatically
	 * create Better Auth users with hashed passwords.
	 */
	auth?: MomentumAuthLike;
}

/**
 * Initialize Momentum CMS with a single function call.
 *
 * Handles:
 * - Database schema initialization (if adapter supports it)
 * - Momentum API singleton initialization
 * - Seeding (if configured in the config)
 *
 * @example
 * ```typescript
 * import { initializeMomentum } from '@momentum-cms/server-express';
 * import momentumConfig from './momentum.config';
 *
 * const { ready, getSeedingStatus } = initializeMomentum(momentumConfig);
 *
 * // Wait for initialization before accepting requests
 * await ready;
 *
 * // Or use non-blocking initialization for faster dev startup
 * ready.catch(console.error);
 * ```
 */
export function initializeMomentum(
	config: MomentumConfig | ResolvedMomentumConfig,
	options: InitializeMomentumOptions = {},
): MomentumInitResult {
	const { auth } = options;

	// Initialize logger from config (must be first)
	const loggingConfig = 'logging' in config && config.logging ? config.logging : undefined;
	initializeMomentumLogger(loggingConfig);
	const log = createLogger('Init');

	// Create plugin runner if plugins are configured
	const plugins = config.plugins ?? [];
	const pluginRunner = new PluginRunner({
		config,
		collections: config.collections,
		plugins,
	});

	let isInitialized = false;
	let seedingResult: SeedingResult | null = null;

	const initialize = async (): Promise<void> => {
		// 1. Run plugin onInit (plugins inject hooks and register middleware/providers)
		if (plugins.length > 0) {
			log.info(`Initializing ${plugins.length} plugin(s)...`);
			await pluginRunner.runInit();

			// Store plugin middleware/providers for auto-mounting
			setPluginMiddleware(pluginRunner.getMiddleware());
			setPluginProviders(pluginRunner.getProviders());
		}

		// 2. Initialize database schema if adapter supports it
		if (config.db.adapter.initialize) {
			log.info('Initializing database schema...');
			await config.db.adapter.initialize(config.collections);
		}

		// 3. Initialize Momentum API singleton
		log.info('Initializing API...');
		const api = initializeMomentumAPI(config);

		// 4. Run seeding if configured
		const runOnStart = config.seeding?.options?.runOnStart ?? 'development';
		if (config.seeding && shouldRunSeeding(runOnStart)) {
			log.info('Running seeding...');
			seedingResult = await runSeeding(config.seeding, config.db.adapter, { auth });
			log.info(
				`Seeding complete: ${seedingResult.created} created, ${seedingResult.updated} updated, ${seedingResult.skipped} skipped`,
			);
		}

		// 5. Run plugin onReady (API is initialized, seeding complete)
		if (plugins.length > 0) {
			log.info('Notifying plugins: ready');
			await pluginRunner.runReady(api);
		}

		isInitialized = true;
		log.info('Initialization complete');
	};

	const ready = initialize();

	return {
		ready,
		get seedingResult() {
			return seedingResult;
		},
		isReady: () => isInitialized,
		getSeedingStatus: () => ({
			completed: seedingResult?.total ?? 0,
			expected: seedingResult?.total ?? 0,
			ready: isInitialized,
		}),
		shutdown: () => pluginRunner.runShutdown(),
	};
}

/**
 * Options for createHealthMiddleware.
 */
export interface HealthMiddlewareOptions {
	/**
	 * Function to check if the server is ready.
	 */
	isReady?: () => boolean;

	/**
	 * Function to get seeding status.
	 */
	getSeedingStatus?: () => SeedingStatus;

	/**
	 * Promise to wait for when ?checkSeeds=true is requested.
	 */
	waitForReady?: Promise<void>;

	/**
	 * Additional health data to include in response.
	 */
	additionalData?: () => Record<string, unknown>;
}

/**
 * Health response structure.
 */
export interface HealthResponse {
	status: 'ok' | 'initializing' | 'error';
	ready: boolean;
	seeds?: SeedingStatus;
	[key: string]: unknown;
}

/**
 * Creates Express middleware for a health endpoint.
 *
 * Features:
 * - Reports server ready status
 * - Reports seeding status (if provided)
 * - Can wait for initialization when ?checkSeeds=true
 *
 * @example
 * ```typescript
 * import { initializeMomentum, createHealthMiddleware } from '@momentum-cms/server-express';
 *
 * const init = initializeMomentum(config);
 *
 * // Mount at /api/health
 * app.use('/api/health', createHealthMiddleware({
 *   isReady: init.isReady,
 *   getSeedingStatus: init.getSeedingStatus,
 *   waitForReady: init.ready,
 * }));
 * ```
 */
export function createHealthMiddleware(options: HealthMiddlewareOptions = {}): Router {
	const router = createRouter();

	router.get('/', async (req: Request, res: Response) => {
		// Wait for initialization if checkSeeds is requested
		if (req.query['checkSeeds'] === 'true' && options.waitForReady) {
			try {
				await options.waitForReady;
			} catch {
				// Initialization failed, continue to return error status
			}
		}

		const isReady = options.isReady?.() ?? true;
		const seedingStatus = options.getSeedingStatus?.();
		const additionalData = options.additionalData?.() ?? {};

		const response: HealthResponse = {
			status: isReady ? 'ok' : 'initializing',
			ready: isReady,
			...additionalData,
		};

		if (seedingStatus) {
			response.seeds = seedingStatus;
		}

		res.json(response);
	});

	return router;
}

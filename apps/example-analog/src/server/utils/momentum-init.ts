/**
 * Shared Momentum CMS initialization for the Analog (h3/Nitro) server.
 *
 * Mirrors the initialization logic of `initializeMomentum()` from
 * server-express, but without Express dependencies. Handles:
 * - Plugin initialization (auth, analytics, event bus)
 * - Database schema creation
 * - Globals table initialization
 * - API singleton initialization
 * - Seeding
 * - Webhook hooks registration
 */

import {
	initializeMomentumAPI,
	runSeeding,
	shouldRunSeeding,
	registerWebhookHooks,
	startPublishScheduler,
	type SeedingResult,
} from '@momentumcms/server-core';
import { initializeMomentumLogger, createLogger } from '@momentumcms/logger';
import { PluginRunner, type PluginMiddlewareDescriptor } from '@momentumcms/plugins/core';
import type { MomentumAuthPlugin } from '@momentumcms/auth';
import type { MomentumAuth } from '@momentumcms/auth';
import momentumConfig, {
	authPlugin,
	analytics,
	analyticsAdapter,
	events,
} from '../../momentum.config';

let initPromise: Promise<void> | null = null;
let authInstance: MomentumAuth | null = null;
let isReady = false;
let seedingResult: SeedingResult | null = null;
let pluginMiddleware: PluginMiddlewareDescriptor[] = [];

async function initialize(): Promise<void> {
	// Initialize logger from config (must be first)
	const loggingConfig =
		'logging' in momentumConfig && momentumConfig.logging ? momentumConfig.logging : undefined;
	initializeMomentumLogger(loggingConfig);
	const log = createLogger('Init');

	// Create plugin runner
	const plugins = momentumConfig.plugins ?? [];
	const pluginRunner = new PluginRunner({
		config: momentumConfig,
		collections: momentumConfig.collections,
		plugins,
	});

	// 1. Run plugin onInit (plugins inject collections, register hooks, etc.)
	if (plugins.length > 0) {
		log.info(`Initializing ${plugins.length} plugin(s)...`);
		await pluginRunner.runInit();
		pluginMiddleware = pluginRunner.getMiddleware();
	}

	// 2. Auto-detect auth instance from the auth plugin
	for (const plugin of plugins) {
		if ('getAuth' in plugin && typeof plugin.getAuth === 'function') {
			try {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Plugin type narrowing
				const ap = plugin as MomentumAuthPlugin;
				authInstance = ap.getAuth();
				log.info('Auth instance ready');
			} catch {
				// Plugin not ready, skip
			}
			break;
		}
	}

	// 3. Register webhook hooks on collections
	registerWebhookHooks(momentumConfig.collections);

	// 4. Initialize database schema
	if (momentumConfig.db.adapter.initialize) {
		log.info('Initializing database schema...');
		await momentumConfig.db.adapter.initialize(momentumConfig.collections);
	}

	// 4b. Initialize globals table
	if (
		momentumConfig.db.adapter.initializeGlobals &&
		momentumConfig.globals &&
		momentumConfig.globals.length > 0
	) {
		log.info(`Initializing globals table for ${momentumConfig.globals.length} global(s)...`);
		await momentumConfig.db.adapter.initializeGlobals(momentumConfig.globals);
	}

	// 5. Initialize Momentum API singleton
	log.info('Initializing API...');
	const api = initializeMomentumAPI(momentumConfig);

	// Expose API on globalThis so the Vite SSR bundle can access it
	// (Vite SSR and Nitro bundles are separate module instances)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions, local/no-direct-browser-apis -- cross-bundle bridge: Nitro and Vite SSR are separate module instances
	(globalThis as any).__momentum_api = api;

	// 6. Run seeding if configured
	const runOnStart = momentumConfig.seeding?.options?.runOnStart ?? 'development';
	if (momentumConfig.seeding && shouldRunSeeding(runOnStart)) {
		log.info('Running seeding...');
		seedingResult = await runSeeding(momentumConfig.seeding, momentumConfig.db.adapter, {
			auth: authInstance ?? undefined,
		});
		log.info(
			`Seeding complete: ${seedingResult.created} created, ${seedingResult.updated} updated, ${seedingResult.skipped} skipped`,
		);
	}

	// 7. Start publish scheduler (auto-publishes documents when scheduledPublishAt arrives)
	startPublishScheduler(momentumConfig.db.adapter, momentumConfig.collections, {
		intervalMs: 2000,
	});
	log.info('Publish scheduler started (interval: 2000ms)');

	// 8. Run plugin onReady (API is initialized, seeding complete)
	if (plugins.length > 0) {
		log.info('Notifying plugins: ready');
		await pluginRunner.runReady(api);
	}

	isReady = true;
	log.info('Initialization complete');
}

/**
 * Ensure Momentum CMS is initialized. Returns immediately if already initialized.
 * Call this from every h3 route handler before processing requests.
 */
export function ensureInitialized(): Promise<void> {
	if (!initPromise) {
		initPromise = initialize().catch((err) => {
			initPromise = null; // Allow retry on next request
			throw err;
		});
	}
	return initPromise;
}

/**
 * Get the Better Auth instance (available after initialization).
 */
export function getAuth(): MomentumAuth | null {
	return authInstance;
}

/**
 * Check if initialization has completed.
 */
export function getIsReady(): boolean {
	return isReady;
}

/**
 * Get seeding result for health endpoint.
 */
export function getSeedingStatus(): {
	completed: number;
	expected: number;
	ready: boolean;
} {
	return {
		completed: seedingResult?.total ?? 0,
		expected: seedingResult?.total ?? 0,
		ready: isReady,
	};
}

/**
 * Get plugin middleware descriptors (available after initialization).
 */
export function getPluginMiddleware(): PluginMiddlewareDescriptor[] {
	return pluginMiddleware;
}

// Re-export plugin instances for test endpoints
export { analytics, analyticsAdapter, events, authPlugin };

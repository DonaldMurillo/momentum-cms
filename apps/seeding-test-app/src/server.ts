// Load environment variables from .env file
import 'dotenv/config';

// Allow localhost webhooks for E2E testing
process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'] = 'true';

import {
	AngularNodeAppEngine,
	createNodeRequestHandler,
	isMainModule,
	writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	momentumApiMiddleware,
	initializeMomentum,
	createHealthMiddleware,
	createApiKeyResolverMiddleware,
	createApiKeyRoutes,
	createOpenAPIMiddleware,
	createDeferredSessionResolver,
	getPluginProviders,
} from '@momentum-cms/server-express';
import {
	getMomentumAPI,
	registerWebhookHooks,
	startPublishScheduler,
	createPostgresApiKeyStore,
} from '@momentum-cms/server-core';
import { provideMomentumAPI } from '@momentum-cms/admin';
import type { CollectionEvent } from '@momentum-cms/plugins/core';
import type { PostgresAdapterWithRaw } from '@momentum-cms/db-drizzle';
import momentumConfig, { events, analytics, analyticsAdapter, authPlugin } from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON request bodies (required for auth endpoints)
app.use(express.json());

/**
 * Get the pg pool from the adapter for API key store
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
const pool = (momentumConfig.db.adapter as PostgresAdapterWithRaw).getPool();

/**
 * Register webhook hooks for all collections with webhook configs
 */
registerWebhookHooks(momentumConfig.collections);

/**
 * In-memory hook test infrastructure for E2E testing.
 * Allows tests to observe hook invocations and configure hook behavior.
 */
import {
	getHookLog,
	clearHookLog,
	getHookBehavior,
	setHookBehavior,
} from './collections/hook-test-items.collection';
import type { HookBehaviorConfig } from './collections/hook-test-items.collection';
import { getFieldHookLog, clearFieldHookLog } from './collections/field-test-items.collection';

app.get('/api/test-hook-log', (_req, res) => {
	const invocations = getHookLog();
	res.json({ invocations, count: invocations.length });
});

app.delete('/api/test-hook-log', (_req, res) => {
	clearHookLog();
	res.json({ cleared: true });
});

app.get('/api/test-hook-config', (_req, res) => {
	res.json(getHookBehavior());
});

app.post('/api/test-hook-config', (req, res) => {
	if (!req.body || typeof req.body !== 'object') {
		res.status(400).json({ error: 'Invalid request body' });
		return;
	}
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Test infrastructure, validated above
	setHookBehavior(req.body as HookBehaviorConfig);
	res.json({ configured: true });
});

/**
 * Field-level hook test infrastructure for E2E testing.
 * Tracks field-level hook invocations (separate from collection-level hooks above).
 */
app.get('/api/test-field-hook-log', (_req, res) => {
	const invocations = getFieldHookLog();
	res.json({ invocations, count: invocations.length });
});

app.delete('/api/test-field-hook-log', (_req, res) => {
	clearFieldHookLog();
	res.json({ cleared: true });
});

/**
 * In-memory webhook receiver for E2E testing.
 * Stores received webhook payloads so tests can verify delivery.
 */
const receivedWebhooks: Array<{
	headers: Record<string, string>;
	body: unknown;
	timestamp: number;
}> = [];

app.post('/api/test-webhook-receiver', (req, res) => {
	receivedWebhooks.push({
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Headers are string values
		headers: Object.fromEntries(
			Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
		) as Record<string, string>,
		body: req.body,
		timestamp: Date.now(),
	});
	res.status(200).json({ received: true });
});

app.get('/api/test-webhook-receiver', (_req, res) => {
	res.json({ webhooks: receivedWebhooks, count: receivedWebhooks.length });
});

app.delete('/api/test-webhook-receiver', (_req, res) => {
	receivedWebhooks.length = 0;
	res.json({ cleared: true });
});

/**
 * Event bus test infrastructure for E2E testing.
 * Captures all collection events so tests can verify event bus delivery.
 */
const eventBusLog: CollectionEvent[] = [];
events.bus.on('*', (event) => eventBusLog.push(event));

app.get('/api/test-event-bus-log', (_req, res) => {
	res.json({ events: eventBusLog, count: eventBusLog.length });
});

app.delete('/api/test-event-bus-log', (_req, res) => {
	eventBusLog.length = 0;
	res.json({ cleared: true });
});

/**
 * Analytics test infrastructure for E2E testing.
 * Exposes analytics events so tests can verify tracking.
 */
app.get('/api/test-analytics-events', async (_req, res) => {
	// Flush pending events first so tests see them immediately
	await analytics.eventStore.flush();
	const result = await analyticsAdapter.query({ limit: 500 });
	res.json(result);
});

app.delete('/api/test-analytics-events', (_req, res) => {
	analyticsAdapter.events.length = 0;
	res.json({ cleared: true });
});

/**
 * Initialize Momentum CMS (database, API, seeding)
 * Auth plugin registers auth/setup middleware automatically.
 * Auth instance is auto-detected from the plugin for seeding.
 *
 * Await ensures the auth plugin is ready before the server accepts requests,
 * so the deferred session resolver can resolve user sessions correctly.
 */
const momentum = initializeMomentum(momentumConfig, {
	// eslint-disable-next-line no-console -- Seeding logger for testing
	logger: (msg) => console.log(`[Seeding Test App] ${msg}`),
});

try {
	await momentum.ready;
} catch (error) {
	console.error('[Seeding Test App] Initialization failed:', error);
	process.exit(1);
}

// momentum.ready already resolved — start scheduler directly
startPublishScheduler(momentumConfig.db.adapter, momentumConfig.collections, {
	intervalMs: 2000, // Check every 2 seconds (short for testing)
	// eslint-disable-next-line no-console -- Scheduler logger
	logger: (msg) => console.log(msg),
});

/**
 * Health endpoint with seed status
 * Used by test runner to poll for seed completion
 */
app.use(
	'/api/health',
	createHealthMiddleware({
		isReady: momentum.isReady,
		getSeedingStatus: momentum.getSeedingStatus,
		waitForReady: momentum.ready,
	}),
);

/**
 * API Key support
 * Create API key store and wire up resolver + management routes
 */
const apiKeyStore = createPostgresApiKeyStore({
	query: async <T extends Record<string, unknown>>(
		sql: string,
		params?: unknown[],
	): Promise<T[]> => {
		const result = await pool.query(sql, params);
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg result rows
		return result.rows as T[];
	},
	queryOne: async <T extends Record<string, unknown>>(
		sql: string,
		params?: unknown[],
	): Promise<T | null> => {
		const result = await pool.query(sql, params);
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg result rows
		return (result.rows[0] as T) ?? null;
	},
	execute: async (sql: string, params?: unknown[]): Promise<number> => {
		const result = await pool.query(sql, params);
		return result.rowCount ?? 0;
	},
});

// API key resolver - checks X-API-Key header before session auth
app.use(createApiKeyResolverMiddleware({ store: apiKeyStore }));

/**
 * Session resolver middleware
 * Resolves user session from auth cookies and attaches to req.user
 * Role comes directly from Better Auth user table (single source of truth)
 */
app.use(createDeferredSessionResolver(authPlugin));

/**
 * API key management endpoints (admin only)
 * GET /api/api-keys, POST /api/api-keys, DELETE /api/api-keys/:id
 */
app.use('/api', createApiKeyRoutes({ store: apiKeyStore }));

/**
 * OpenAPI / Swagger documentation
 * Mounted at /api/docs before the main API to avoid route conflicts
 */
app.use('/api/docs', createOpenAPIMiddleware({ config: momentumConfig }));

/**
 * Momentum CMS API endpoints
 * Handles CRUD operations for all collections.
 * Plugin middleware (analytics ingest, API collector, etc.) is auto-mounted by the framework.
 */
app.use('/api', momentumApiMiddleware(momentumConfig));

/**
 * Serve static files from /browser
 */
app.use(
	express.static(browserDistFolder, {
		maxAge: '1y',
		index: false,
		redirect: false,
	}),
);

/**
 * Handle all other requests by rendering the Angular application.
 * Passes the Momentum API and user context for SSR.
 */
app.use('/**', (req, res, next) => {
	// Get user context from request (set by session resolver middleware if authenticated)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Express request augmentation
	const user = (req as any).user ?? undefined;

	angularApp
		.handle(req, {
			providers: [
				...provideMomentumAPI(getMomentumAPI(), { user }),
				...getPluginProviders().map((p) => ({ provide: p.token, useValue: p.value })),
			],
		})
		.then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
		.catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
	const port = process.env['PORT'] || momentumConfig.server.port;
	app.listen(port, () => {
		// eslint-disable-next-line no-console -- Seeding logger for testing
		console.log(`[Seeding Test App] Server listening on http://localhost:${port}`);
	});
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

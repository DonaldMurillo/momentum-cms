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
	createAuthMiddleware,
	createSetupMiddleware,
	createSessionResolverMiddleware,
	createApiKeyResolverMiddleware,
	createApiKeyRoutes,
	createOpenAPIMiddleware,
} from '@momentum-cms/server-express';
import {
	getMomentumAPI,
	createUserSyncHook,
	registerWebhookHooks,
	startPublishScheduler,
	createPostgresApiKeyStore,
} from '@momentum-cms/server-core';
import { createMomentumAuth } from '@momentum-cms/auth';
import { provideMomentumAPI } from '@momentum-cms/admin';
import type { PostgresAdapterWithRaw } from '@momentum-cms/db-drizzle';
import momentumConfig from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON request bodies (required for auth endpoints)
app.use(express.json());

/**
 * Get the pg pool from the adapter for Better Auth
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
const dbAdapter = momentumConfig.db.adapter as PostgresAdapterWithRaw;
const pool = dbAdapter.getPool();

/**
 * Create Better Auth instance with PostgreSQL
 * Email is enabled automatically if SMTP_HOST env var is set
 */
const authBaseURL =
	process.env['BETTER_AUTH_URL'] || `http://localhost:${momentumConfig.server.port}`;

const auth = createMomentumAuth({
	db: { type: 'postgres', pool },
	baseURL: authBaseURL,
	trustedOrigins: ['http://localhost:4200', authBaseURL],
	email: {
		// Email is auto-enabled when SMTP_HOST is set
		// Configure via environment variables:
		// SMTP_HOST=localhost SMTP_PORT=1025 SMTP_FROM=noreply@momentum.local
		appName: 'Seeding Test App',
	},
	twoFactorAuth: true,
});

/**
 * Add user sync hooks to users collection
 * This ensures Momentum users are synced with Better Auth users on creation
 * The hook is prepended so it runs BEFORE the collection's built-in password stripper
 */
const usersCollection = momentumConfig.collections.find((c) => c.slug === 'users');
if (usersCollection) {
	const existingHooks = usersCollection.hooks?.beforeChange ?? [];
	usersCollection.hooks = usersCollection.hooks ?? {};
	usersCollection.hooks.beforeChange = [createUserSyncHook({ auth }), ...existingHooks];
}

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
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Test infrastructure, body is HookBehaviorConfig
	setHookBehavior(req.body as HookBehaviorConfig);
	res.json({ configured: true });
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
 * Initialize Momentum CMS (database, API, seeding)
 * This is called AFTER hooks are configured so seeding benefits from them
 */
const momentum = initializeMomentum(momentumConfig, {
	auth,
	// eslint-disable-next-line no-console -- Seeding logger for testing
	logger: (msg) => console.log(`[Seeding Test App] ${msg}`),
});

// Handle initialization errors
momentum.ready.catch((error) => {
	console.error('[Seeding Test App] Initialization failed:', error);
	process.exit(1);
});

// Start the publish scheduler after initialization
momentum.ready
	.then(() => {
		startPublishScheduler(momentumConfig.db.adapter, momentumConfig.collections, {
			intervalMs: 2000, // Check every 2 seconds (short for testing)
			// eslint-disable-next-line no-console -- Scheduler logger
			logger: (msg) => console.log(msg),
		});
	})
	.catch(() => {
		// Initialization failure already handled above
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
 * Auth endpoints (Better Auth)
 * Handles sign-in, sign-up, sign-out, session management, password reset
 */
app.use('/api', createAuthMiddleware(auth));

/**
 * Setup endpoints
 * Handles first-time setup status and admin creation
 */
app.use(
	'/api',
	createSetupMiddleware({ db: { type: 'postgres', pool }, auth, adapter: dbAdapter }),
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
 * Must be before API middleware for access control to work
 */
app.use(
	createSessionResolverMiddleware(auth, {
		getRoleByEmail: async (email: string): Promise<string | undefined> => {
			try {
				// Use setContext with a system admin user to bypass access control
				const api = getMomentumAPI();
				const systemApi = api.setContext({
					user: { id: 'system', email: 'system@localhost', role: 'admin' },
				});
				// Filter by email server-side to avoid fetching all users
				const result = await systemApi
					.collection<{ email: string; role?: string }>('users')
					.find({ where: { email: { equals: email } }, limit: 1 });
				return result.docs[0]?.role;
			} catch {
				return undefined;
			}
		},
	}),
);

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
 * Handles CRUD operations for all collections
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
			providers: provideMomentumAPI(getMomentumAPI(), { user }),
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

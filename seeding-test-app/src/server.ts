// Load environment variables from .env file
import 'dotenv/config';

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
} from '@momentum-cms/server-express';
import { getMomentumAPI, createUserSyncHook } from '@momentum-cms/server-core';
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
const auth = createMomentumAuth({
	db: { type: 'postgres', pool },
	baseURL: `http://localhost:${momentumConfig.server.port}`,
	trustedOrigins: ['http://localhost:4200', `http://localhost:${momentumConfig.server.port}`],
	email: {
		// Email is auto-enabled when SMTP_HOST is set
		// Configure via environment variables:
		// SMTP_HOST=localhost SMTP_PORT=1025 SMTP_FROM=noreply@momentum.local
		appName: 'Seeding Test App',
	},
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
 * Initialize Momentum CMS (database, API, seeding)
 * This is called AFTER hooks are configured so seeding benefits from them
 */
const momentum = initializeMomentum(momentumConfig, {
	// eslint-disable-next-line no-console -- Seeding logger for testing
	logger: (msg) => console.log(`[Seeding Test App] ${msg}`),
});

// Handle initialization errors
momentum.ready.catch((error) => {
	console.error('[Seeding Test App] Initialization failed:', error);
	process.exit(1);
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
				// Fetch all users and filter client-side
				const result = await systemApi
					.collection<{ email: string; role?: string }>('users')
					.find({ limit: 1000 });
				const user = result.docs.find((u) => u.email === email);
				return user?.role;
			} catch {
				return undefined;
			}
		},
	}),
);

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

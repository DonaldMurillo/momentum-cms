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
	createAuthMiddleware,
	createSetupMiddleware,
	createSessionResolverMiddleware,
} from '@momentum-cms/server-express';
import { createMomentumAuth } from '@momentum-cms/auth';
import {
	initializeMomentumAPI,
	getMomentumAPI,
	createUserSyncHook,
} from '@momentum-cms/server-core';
import { provideMomentumAPI } from '@momentum-cms/admin';
import type { PostgresAdapterWithRaw } from '@momentum-cms/db-drizzle';
import momentumConfig from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON request bodies (required for auth endpoints)
app.use(express.json());

// Initialize database schema if the adapter supports it
if (momentumConfig.db.adapter.initialize) {
	momentumConfig.db.adapter.initialize(momentumConfig.collections).catch(console.error);
}

// Get the pg pool from the adapter for Better Auth
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
const dbAdapter = momentumConfig.db.adapter as PostgresAdapterWithRaw;
const pool = dbAdapter.getPool();

// Create Better Auth instance with PostgreSQL
const auth = createMomentumAuth({
	db: { type: 'postgres', pool },
	baseURL: `http://localhost:${momentumConfig.server.port}`,
	trustedOrigins: ['http://localhost:4200', `http://localhost:${momentumConfig.server.port}`],
});

// Add user sync hooks to users collection
// This ensures Momentum users are synced with Better Auth users on creation
// The hook is prepended so it runs BEFORE the collection's built-in password stripper
const usersCollection = momentumConfig.collections.find((c) => c.slug === 'users');
if (usersCollection) {
	const existingHooks = usersCollection.hooks?.beforeChange ?? [];
	usersCollection.hooks = usersCollection.hooks ?? {};
	usersCollection.hooks.beforeChange = [createUserSyncHook({ auth }), ...existingHooks];
}

// Initialize Momentum API singleton (after hooks are configured)
initializeMomentumAPI(momentumConfig);

/**
 * Auth endpoints (Better Auth)
 * Handles sign-in, sign-up, sign-out, session management
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
				// This is necessary because we're in the session resolver middleware
				// and don't have a user context yet - but need to read the users collection
				const api = getMomentumAPI();
				const systemApi = api.setContext({
					user: { id: 'system', email: 'system@localhost', role: 'admin' },
				});
				// Note: where clause filtering has issues with the current API, so fetch all and filter client-side
				// Use high limit to get all users (default limit is 10)
				const result = await systemApi
					.collection<{ email: string; role?: string }>('users')
					.find({ limit: 1000 });
				const user = result.docs.find((u) => u.email === email);
				return user?.role;
			} catch (error) {
				console.error(`[SessionResolver] Role lookup error for ${email}:`, error);
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
 * Serve Storybook static files at /storybook
 * Built Storybook files are served from dist/storybook/ui
 */
const storybookDistFolder = resolve(serverDistFolder, '../../../storybook/ui');
app.use(
	'/storybook',
	express.static(storybookDistFolder, {
		maxAge: '1y',
		index: 'index.html',
	}),
);

// Fallback for Storybook SPA routing (iframe.html, etc.)
app.get('/storybook/*', (req, res) => {
	res.sendFile(resolve(storybookDistFolder, 'index.html'));
});

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
			// Provide the Momentum API to Angular during SSR
			providers: provideMomentumAPI(getMomentumAPI(), { user }),
		})
		.then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
		.catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
	const port = process.env['PORT'] || momentumConfig.server.port;
	app.listen(port);
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

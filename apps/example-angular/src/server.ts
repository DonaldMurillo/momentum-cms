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
} from '@momentum-cms/server-express';
import { createMomentumAuth } from '@momentum-cms/auth';
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
 */
app.use('/**', (req, res, next) => {
	angularApp
		.handle(req)
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

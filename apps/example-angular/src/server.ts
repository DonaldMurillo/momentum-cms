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
	createDeferredSessionResolver,
} from '@momentum-cms/server-express';
import { getMomentumAPI } from '@momentum-cms/server-core';
import { provideMomentumAPI } from '@momentum-cms/admin';
import momentumConfig, { authPlugin } from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON request bodies (required for auth endpoints)
app.use(express.json());

// Initialize Momentum CMS (database schema, API, seeding — auth plugin registers middleware)
// Await ensures the auth plugin is ready before the server accepts requests,
// so the deferred session resolver can resolve user sessions correctly.
const momentum = initializeMomentum(momentumConfig);
try {
	await momentum.ready;
} catch (error) {
	console.error('[Example Angular] Initialization failed:', error);
	process.exit(1);
}

/**
 * Session resolver middleware
 * Resolves user session from auth cookies and attaches to req.user
 * Must be before Angular SSR for access control to work
 */
app.use(createDeferredSessionResolver(authPlugin));

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

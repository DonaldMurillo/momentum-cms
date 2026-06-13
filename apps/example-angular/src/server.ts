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
	configureHttpServerTimeouts,
	createMomentumServer,
	sanitizedJsonErrorHandler,
} from '@momentumcms/server-express';
import { provideMomentumAPI } from '@momentumcms/admin';
import { mountTestEndpoints } from '@momentumcms/example-config';
import momentumConfig, {
	authPlugin,
	analytics,
	analyticsAdapter,
	events,
	pool,
} from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const angularApp = new AngularNodeAppEngine({
	allowedHosts: ['localhost'],
});

/**
 * Create Express app and mount test endpoints BEFORE the CMS API middleware.
 * Test endpoints must be registered first because the CMS API is a catch-all at /api.
 */
const app = express();
// Scope the JSON body parser to /api/* so requests that fall through to the
// Angular SSR handler don't have their streams consumed. Without scoping,
// the SSR layer crashes with "Response body … locked" reconstructing a
// Request from a drained stream. 10mb accommodates import-export batches.
app.use('/api', express.json({ limit: '10mb' }));
// Sanitize body-parser errors (SyntaxError, charset, payload-too-large) into
// JSON envelopes so unknown clients don't see HTML stack traces with file://
// paths. Must run after the body parser but before the test endpoints + the
// CMS API router that also mounts at /api.
app.use('/api', sanitizedJsonErrorHandler);
mountTestEndpoints(app, { analytics, analyticsAdapter, events, pool });

/**
 * Create the Momentum CMS server with a single call.
 * Handles: init, plugins, DB schema, seeding, webhooks, health,
 * session resolver, OpenAPI docs, and CMS API endpoints.
 */
const server = await createMomentumServer({
	config: momentumConfig,
	app,
	authPlugin,
	health: true,
	openapi: true,
	publishScheduler: { intervalMs: 2000 },
	providerFactory: (api, ctx) =>
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- server-express uses unknown to avoid admin dependency
		provideMomentumAPI(api as Parameters<typeof provideMomentumAPI>[0], ctx),
});

/**
 * Serve static files from /browser
 */
server.app.use(
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
server.app.use(
	'/storybook',
	express.static(storybookDistFolder, {
		maxAge: '1y',
		index: 'index.html',
	}),
);

// Fallback for Storybook SPA routing (iframe.html, etc.)
server.app.get('/storybook/*', (req, res) => {
	res.sendFile(resolve(storybookDistFolder, 'index.html'));
});

/**
 * Handle all other requests by rendering the Angular application.
 * Passes the Momentum API and user context for SSR.
 */
server.app.use('/**', (req, res, next) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Express request augmentation
	const user = (req as any).user ?? undefined;

	angularApp
		.handle(req, { providers: server.getSsrProviders(user) })
		.then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
		.catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
	const port = process.env['PORT'] || momentumConfig.server.port;
	const httpServer = server.app.listen(port);
	configureHttpServerTimeouts(httpServer);
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(server.app);

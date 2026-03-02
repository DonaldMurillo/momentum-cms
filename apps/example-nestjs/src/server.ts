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
import { createMomentumNestServer } from '@momentumcms/server-nestjs';
import { provideMomentumAPI } from '@momentumcms/admin';
import { mountTestEndpoints } from '@momentumcms/example-config';
import momentumConfig, { analytics, analyticsAdapter, events } from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const angularApp = new AngularNodeAppEngine({
	allowedHosts: ['localhost'],
});

/**
 * Create the Momentum CMS NestJS server.
 * Handles: plugin lifecycle, DB initialization, API singleton, auth/setup middleware,
 * health endpoint, all CMS API routes, session resolution, and publish scheduler.
 */
const server = await createMomentumNestServer({
	config: momentumConfig,
	publishScheduler: { intervalMs: 2000 },
	providerFactory: (api, ctx) =>
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- server-nestjs uses unknown to avoid admin dependency
		provideMomentumAPI(api as Parameters<typeof provideMomentumAPI>[0], ctx),
});

/**
 * Get the underlying Express instance for static files and Angular SSR.
 * NestJS uses Express under the hood — we access it for non-API routes.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- NestJS Express adapter returns Express instance
const expressApp = server.app.getHttpAdapter().getInstance() as express.Express;

/**
 * Mount test endpoints BEFORE static files.
 * Test endpoints must be registered for E2E test infrastructure.
 */
mountTestEndpoints(expressApp, { analytics, analyticsAdapter, events });

/**
 * Serve static files from /browser
 */
expressApp.use(
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
expressApp.use(
	'/storybook',
	express.static(storybookDistFolder, {
		maxAge: '1y',
		index: 'index.html',
	}),
);

// Fallback for Storybook SPA routing (iframe.html, etc.)
expressApp.get('/storybook/{*path}', (req, res) => {
	res.sendFile(resolve(storybookDistFolder, 'index.html'));
});

/**
 * Handle all other requests by rendering the Angular application.
 * Session resolver is already mounted by createMomentumNestServer,
 * so req.user is available for access-controlled SSR rendering.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express request augmentation for req.user
expressApp.use((req: any, res, next) => {
	const user = req.user ?? undefined;

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
	await server.app.listen(port);
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(expressApp);

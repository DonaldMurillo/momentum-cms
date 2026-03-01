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
import { SessionMiddleware } from '@momentumcms/server-nestjs';
import { mountTestEndpoints } from '@momentumcms/example-config';
import momentumConfig, { authPlugin, analytics, analyticsAdapter, events } from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const angularApp = new AngularNodeAppEngine({
	allowedHosts: ['localhost'],
});

/**
 * Create the Momentum CMS NestJS server.
 * Handles: DB initialization, API singleton, webhook hooks,
 * health endpoint, CRUD controllers, exception filter, guards.
 */
const server = await createMomentumNestServer({
	config: momentumConfig,
});

/**
 * Wire the session resolver from the auth plugin into the NestJS middleware.
 */
const sessionMiddleware = server.app.get(SessionMiddleware);
if (authPlugin?.getAuth) {
	const auth = authPlugin.getAuth();
	sessionMiddleware.setSessionResolver(async (req: express.Request) => {
		// Convert Express IncomingHttpHeaders to Record<string, string> for Better Auth
		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries(req.headers)) {
			if (typeof value === 'string') headers[key] = value;
			else if (Array.isArray(value)) headers[key] = value.join(', ');
		}
		const session = await auth.api.getSession({ headers });
		if (!session?.user) return undefined;
		const user = session.user;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth user type includes role via plugin
		const role = (user as Record<string, unknown>)['role'] as string;
		return { id: user.id, email: user.email, role };
	});
}

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
 */
expressApp.use((req, res, next) => {
	angularApp
		.handle(req, { providers: [] })
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

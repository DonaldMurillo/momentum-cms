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
import { createMomentumServer } from '@momentumcms/server-express';
import { provideMomentumAPI } from '@momentumcms/admin';
import momentumConfig, { authPlugin } from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const angularApp = new AngularNodeAppEngine({
	allowedHosts: ['localhost'],
});

const app = express();
app.use(express.json());

/**
 * Create the Momentum CMS server.
 */
const server = await createMomentumServer({
	config: momentumConfig,
	app,
	authPlugin,
	health: true,
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
 * Handle all other requests by rendering the Angular application.
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
 * Start the server if this module is the main entry point.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
	const port = process.env['PORT'] || momentumConfig.server.port;
	server.app.listen(port);
}

export const reqHandler = createNodeRequestHandler(server.app);

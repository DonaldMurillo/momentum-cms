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
} from '@momentum-cms/server-express';
import { getMomentumAPI } from '@momentum-cms/server-core';
import { provideMomentumAPI } from '@momentum-cms/admin';
import momentumConfig from './momentum.config';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON request bodies
app.use(express.json());

/**
 * Initialize Momentum CMS (database, API, seeding)
 * Single function call replaces ~30 lines of boilerplate
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
		.handle(req, {
			providers: provideMomentumAPI(getMomentumAPI()),
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

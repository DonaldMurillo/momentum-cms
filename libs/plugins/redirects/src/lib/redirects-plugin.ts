import type {
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
	MomentumAPI,
} from '@momentumcms/plugins/core';
import type { RedirectsPluginConfig } from './redirects-config.types';
import { RedirectsCollection } from './redirects-collection';
import { createRedirectsRouter } from './redirects-handler';

/**
 * Creates a redirects plugin for Momentum CMS.
 *
 * Registers a root-level Express middleware that intercepts requests
 * matching redirect rules stored in the `redirects` collection.
 *
 * @param config - Optional plugin configuration
 * @returns Plugin instance
 */
export function redirectsPlugin(config: RedirectsPluginConfig = {}): MomentumPlugin {
	const { enabled = true, cacheTtl } = config;

	let momentumApi: MomentumAPI | null = null;

	return {
		name: 'redirects',
		collections: [RedirectsCollection],

		async onInit({ collections, logger, registerMiddleware }: PluginContext) {
			if (!enabled) {
				logger.info('Redirects plugin disabled');
				return;
			}

			// Add collection (guard prevents duplicate on re-init)
			if (!collections.some((c) => c.slug === 'redirects')) {
				collections.push(RedirectsCollection);
			}

			// Create redirect handler
			const { router } = createRedirectsRouter(() => momentumApi, { cacheTtl });

			// Register at root level — runs before Angular SSR
			registerMiddleware({
				path: '/',
				handler: router,
				position: 'root',
			});

			logger.info('Redirects plugin initialized');
		},

		async onReady({ logger, api }: PluginReadyContext) {
			if (!enabled) return;
			momentumApi = api;
			logger.info('Redirects plugin ready');
		},

		async onShutdown({ logger }) {
			logger.info('Redirects plugin shut down');
		},
	};
}

import type { MomentumAPI } from '@momentumcms/core';
import type { EmailPluginConfig, EmailPluginInstance } from './email-plugin-config.types';
import { EmailTemplatesCollection } from './email-templates.collection';

/**
 * Email template management plugin for Momentum CMS.
 *
 * Registers the `email-templates` collection and exposes browser-safe admin routes
 * for the visual email builder. Provides a DB-first template lookup API for auth
 * email rendering.
 *
 * @example
 * ```typescript
 * import { emailPlugin } from '@momentumcms/plugins/email';
 *
 * const email = emailPlugin();
 *
 * const config = defineMomentumConfig({
 *   plugins: [email],
 * });
 * ```
 */
export function emailPlugin(config: EmailPluginConfig = {}): EmailPluginInstance {
	const { enabled = true } = config;
	let momentumApi: MomentumAPI | null = null;

	// Variable-based path prevents esbuild/TS from following the import at build time.
	// For browser builds, use @momentumcms/plugins-email/admin-routes directly.
	const emailBuilderModule = '@momentumcms/email-builder';
	const adminRoutes = enabled
		? [
				{
					path: 'email-builder',
					label: 'Email Builder',
					icon: 'heroEnvelopeOpen',
					loadComponent: (): Promise<unknown> =>
						import(emailBuilderModule).then(
							(m: Record<string, unknown>) => m['EmailBuilderStudioPage'],
						),
					group: 'Tools',
				},
			]
		: [];

	return {
		name: 'email',
		collections: enabled ? [EmailTemplatesCollection] : [],
		adminRoutes,

		browserImports: {
			adminRoutes: {
				path: '@momentumcms/plugins-email/admin-routes',
				exportName: 'emailAdminRoutes',
			},
		},

		async onInit({ collections, logger }) {
			if (!enabled) {
				logger.info('Email plugin disabled');
				return;
			}

			// Guard: only push if not already present (idempotency)
			if (!collections.some((c) => c.slug === 'email-templates')) {
				collections.push(EmailTemplatesCollection);
			}

			logger.info('Email plugin initialized');
		},

		async onReady({ api, logger }) {
			momentumApi = api;
			logger.info('Email plugin ready');
		},

		getApi(): MomentumAPI | null {
			return momentumApi;
		},
	};
}

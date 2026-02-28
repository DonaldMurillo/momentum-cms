/**
 * Form builder plugin for Momentum CMS.
 *
 * Provides:
 * - `forms` collection for storing form definitions
 * - `form-submissions` collection for storing submissions
 * - REST endpoints for schema retrieval, validation, and submission
 * - Webhook forwarding for submissions
 * - Admin routes for form management
 */

import type {
	MomentumAPI,
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
} from '@momentumcms/core';
import type { FormBuilderPluginConfig } from './types/form-builder-plugin-config.types';
import { FormsCollection } from './collections/forms.collection';
import { FormSubmissionsCollection } from './collections/form-submissions.collection';
import { createFormApiRouter } from './middleware/form-api-router';
import { FORM_BUILDER_ADMIN_ROUTES } from './form-builder-admin-routes';

const PLUGIN_NAME = 'form-builder';

/**
 * Create the form builder plugin.
 *
 * @example
 * ```typescript
 * import { formBuilderPlugin } from '@momentumcms/plugins-form-builder';
 *
 * export default momentumConfig({
 *   plugins: [
 *     formBuilderPlugin({ honeypot: true, rateLimitPerMinute: 10 }),
 *   ],
 * });
 * ```
 */
export function formBuilderPlugin(_config?: FormBuilderPluginConfig): MomentumPlugin {
	const config: Required<FormBuilderPluginConfig> = {
		honeypot: _config?.honeypot ?? true,
		rateLimitPerMinute: _config?.rateLimitPerMinute ?? 10,
	};

	let momentumApi: MomentumAPI | null = null;

	return {
		name: PLUGIN_NAME,

		collections: [FormsCollection, FormSubmissionsCollection],

		adminRoutes: FORM_BUILDER_ADMIN_ROUTES,

		browserImports: {
			adminRoutes: {
				path: '@momentumcms/plugins-form-builder/admin-routes',
				exportName: 'FORM_BUILDER_ADMIN_ROUTES',
			},
		},

		async onInit({ collections, logger, registerMiddleware }: PluginContext): Promise<void> {
			// Idempotency guards — don't double-push collections
			if (!collections.some((c) => c.slug === 'forms')) {
				collections.push(FormsCollection);
			}
			if (!collections.some((c) => c.slug === 'form-submissions')) {
				collections.push(FormSubmissionsCollection);
			}

			// Register public form API endpoints
			const formRouter = createFormApiRouter({
				getApi: () => momentumApi,
				honeypot: config.honeypot,
				rateLimitPerMinute: config.rateLimitPerMinute,
				logger,
			});

			registerMiddleware({
				path: '/',
				handler: formRouter,
				position: 'before-api',
			});

			logger.info(
				`Form builder plugin initialized (honeypot=${config.honeypot}, rateLimit=${config.rateLimitPerMinute}/min)`,
			);
		},

		async onReady({ api, logger }: PluginReadyContext): Promise<void> {
			// Elevate to admin context for internal operations (reading forms, saving submissions,
			// incrementing counters). Public endpoints use this API to access the forms collection
			// which has `read: hasRole('admin')` access control.
			momentumApi = api.setContext({ user: { id: 'system:form-builder', role: 'admin' } });
			logger.info('Form builder plugin ready');
		},

		async onShutdown({ logger }: PluginContext): Promise<void> {
			momentumApi = null;
			logger.info('Form builder plugin shut down');
		},
	};
}

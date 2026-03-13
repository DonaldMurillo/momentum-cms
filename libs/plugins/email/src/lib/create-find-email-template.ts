import type { EmailPluginInstance } from './email-plugin-config.types';

/**
 * Result of looking up an email template from the database.
 * Matches the DbEmailTemplate shape expected by `@momentumcms/auth`.
 */
interface DbEmailTemplate {
	subject?: string;
	emailBlocks?: unknown[];
}

/**
 * Minimal collection operations interface — avoids importing from @momentumcms/server-core.
 * The core MomentumAPI returns `unknown` from `collection()` to prevent circular deps.
 */
interface CollectionOps {
	find(options?: {
		where?: Record<string, unknown>;
		limit?: number;
	}): Promise<{ docs: Record<string, unknown>[] }>;
}

interface EmailPluginApi {
	setContext(context: { overrideAccess: boolean }): EmailPluginApi;
	collection(slug: string): CollectionOps;
}

function hasSystemApi(value: unknown): value is EmailPluginApi {
	return (
		typeof value === 'object' &&
		value !== null &&
		'setContext' in value &&
		typeof value['setContext'] === 'function' &&
		'collection' in value &&
		typeof value['collection'] === 'function'
	);
}

/**
 * Creates a `findEmailTemplate` callback for auth integration.
 *
 * This function returns a lazy callback that queries the `email-templates` collection
 * via the email plugin's API reference. The API is resolved at call time (not at config time),
 * so it's safe to wire this before the API is initialized.
 *
 * @example
 * ```typescript
 * import { emailPlugin, createFindEmailTemplate } from '@momentumcms/plugins/email';
 * import { momentumAuth } from '@momentumcms/auth';
 *
 * const email = emailPlugin();
 *
 * const auth = momentumAuth({
 *   db: { type: 'sqlite', database: db },
 *   email: {
 *     appName: 'My App',
 *     findEmailTemplate: createFindEmailTemplate(email),
 *   },
 * });
 * ```
 */
export function createFindEmailTemplate(
	emailPluginInstance: EmailPluginInstance,
): (slug: string) => Promise<DbEmailTemplate | null> {
	return async (slug: string): Promise<DbEmailTemplate | null> => {
		const api = emailPluginInstance.getApi();
		if (!hasSystemApi(api)) return null;

		try {
			// System email generation must bypass collection access rules.
			// These templates are internal configuration, not user-facing reads.
			const ops = api.setContext({ overrideAccess: true }).collection('email-templates');
			const result = await ops.find({
				where: { slug: { equals: slug } },
				limit: 1,
			});

			if (!result.docs || result.docs.length === 0) return null;

			const doc = result.docs[0];
			return {
				subject: typeof doc['subject'] === 'string' ? doc['subject'] : undefined,
				emailBlocks: Array.isArray(doc['emailBlocks']) ? doc['emailBlocks'] : undefined,
			};
		} catch (error) {
			console.warn('[momentum:email] Failed to look up email template:', error);
			return null;
		}
	};
}

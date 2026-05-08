/**
 * Shared preview route handler.
 *
 * GET/POST /:collection/:id/preview — renders styled HTML for the live
 * preview iframe. GET loads the doc from the database; POST renders the
 * supplied form data without persisting (live preview).
 *
 * Email rendering differs per adapter (Express imports @momentumcms/email;
 * Analog imports the server sub-path), so adapters supply a renderEmail
 * callback. All other validation, access control, and error mapping lives
 * here to keep adapter parity locked in.
 */

import type {
	CollectionConfig,
	MomentumConfig,
	ResolvedMomentumConfig,
	UserContext,
} from '@momentumcms/core';
import type { HandlerResult } from './handler-types';
import { getMomentumAPI } from './momentum-api';
import { renderPreviewHTML } from './preview-renderer';
import { sanitizeErrorMessage } from './shared-server-utils';

export interface PreviewHandlerParams {
	config: MomentumConfig | ResolvedMomentumConfig;
	collectionSlug: string;
	id: string;
	method: 'GET' | 'POST';
	postBody?: Record<string, unknown>;
	user?: UserContext;
	/**
	 * Render an email-builder doc to HTML. Adapters supply this because
	 * the import path of `@momentumcms/email` differs by runtime.
	 */
	renderEmail: (doc: Record<string, unknown>, fieldName: string) => Promise<string>;
}

function getEmailBuilderFieldName(collection: CollectionConfig): string | undefined {
	const field = collection.fields.find(
		(f) => f.type === 'json' && f.admin?.editor === 'email-builder',
	);
	return field?.name;
}

export async function handlePreviewRequest(params: PreviewHandlerParams): Promise<HandlerResult> {
	const { config, collectionSlug, id, method, postBody, user, renderEmail } = params;

	if (!user) {
		return {
			status: 401,
			body: { error: 'Authentication required to access preview' },
		};
	}

	const collectionConfig = config.collections.find((c) => c.slug === collectionSlug);
	if (!collectionConfig) {
		return { status: 404, body: { error: 'Collection not found' } };
	}

	// Enforce collection-level access.read before rendering
	const accessFn = collectionConfig.access?.read;
	if (accessFn) {
		const allowed = await Promise.resolve(accessFn({ req: { user } }));
		if (!allowed) {
			return { status: 403, body: { error: 'Access denied' } };
		}
	}

	try {
		let doc: Record<string, unknown>;
		if (method === 'POST') {
			const data = postBody?.['data'];
			if (!data || typeof data !== 'object') {
				return {
					status: 400,
					body: { error: 'POST preview requires { data: ... } body' },
				};
			}
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- runtime-checked record
			doc = data as Record<string, unknown>;
		} else {
			const api = getMomentumAPI();
			const contextApi = api.setContext({ user });
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- API returns Record<string, unknown>
			doc = (await contextApi.collection(collectionSlug).findById(id)) as Record<string, unknown>;
		}

		const emailField = getEmailBuilderFieldName(collectionConfig);
		const html = emailField
			? await renderEmail(doc, emailField)
			: renderPreviewHTML({ doc, collection: collectionConfig });

		return {
			status: 200,
			body: html,
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		};
	} catch (error) {
		const message = sanitizeErrorMessage(error, 'Unknown error');
		if (message.includes('Access denied')) {
			return { status: 403, body: { error: message } };
		}
		if (message.includes('not found')) {
			return { status: 404, body: { error: message } };
		}
		return { status: 500, body: { error: 'Preview failed', message } };
	}
}

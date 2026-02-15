import {
	defineEventHandler,
	readBody,
	getQuery,
	getRouterParams,
	setResponseStatus,
	setResponseHeader,
	readMultipartFormData,
	send,
	getHeaders,
} from 'h3';
import { createComprehensiveMomentumHandler } from '@momentum-cms/server-analog';
import {
	createAdapterApiKeyStore,
	isValidApiKeyFormat,
	hashApiKey,
} from '@momentum-cms/server-core';
import { ensureInitialized, getAuth } from '../../utils/momentum-init';
import momentumConfig from '../../../momentum.config';

let handler: ReturnType<typeof createComprehensiveMomentumHandler>;
let apiKeyStore: ReturnType<typeof createAdapterApiKeyStore> | null = null;

/**
 * Catch-all API handler for Momentum CMS.
 * Handles all collection CRUD, globals, versioning, publishing, media,
 * GraphQL, batch operations, search, import/export, API keys, and custom endpoints.
 *
 * Auth order: API key → Better Auth session (matches Express middleware order).
 */
export default defineEventHandler(async (event) => {
	// Ensure full initialization (plugins, DB, seeding) has completed
	await ensureInitialized();

	if (!handler) {
		handler = createComprehensiveMomentumHandler(momentumConfig);
	}

	let user: { id: string; email?: string; name?: string; role?: string } | undefined;

	// 1. Try API key authentication first (X-API-Key header)
	const rawHeaders = getHeaders(event);
	const apiKeyHeader = rawHeaders['x-api-key'];
	if (apiKeyHeader && typeof apiKeyHeader === 'string') {
		// Reject malformed API keys immediately (matches Express middleware behavior)
		if (!isValidApiKeyFormat(apiKeyHeader)) {
			setResponseStatus(event, 401);
			return { error: 'Invalid API key format' };
		}
	}
	if (apiKeyHeader && typeof apiKeyHeader === 'string' && isValidApiKeyFormat(apiKeyHeader)) {
		try {
			if (!apiKeyStore) {
				apiKeyStore = createAdapterApiKeyStore(momentumConfig.db.adapter);
			}
			const keyHash = hashApiKey(apiKeyHeader);
			const record = await apiKeyStore.findByHash(keyHash);

			if (record) {
				// Check expiration
				if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
					setResponseStatus(event, 401);
					return { error: 'API key expired' };
				}

				user = {
					id: `apikey:${record.id}`,
					email: `apikey-${record.name}@system`,
					name: `API Key: ${record.name}`,
					role: record.role,
				};

				// Update last used (fire and forget)
				apiKeyStore.updateLastUsed(record.id, new Date().toISOString()).catch(() => {
					// Silently ignore — non-critical update
				});
			} else {
				setResponseStatus(event, 401);
				return { error: 'Invalid API key' };
			}
		} catch {
			setResponseStatus(event, 500);
			return { error: 'API key validation failed' };
		}
	}

	// 2. If no API key, try session auth via Better Auth
	if (!user) {
		const auth = getAuth();
		if (auth) {
			try {
				const headers = new Headers();
				for (const [key, value] of Object.entries(rawHeaders)) {
					if (value != null) {
						headers.set(key, value);
					}
				}
				const session = await auth.api.getSession({ headers });
				if (session) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth user type doesn't include custom fields
					const userRecord = session.user as Record<string, unknown>;
					const role = typeof userRecord['role'] === 'string' ? userRecord['role'] : 'user';
					user = {
						id: session.user.id,
						email: session.user.email,
						role,
					};
				}
			} catch {
				// Session validation failed — continue without auth
			}
		}
	}

	// Call the comprehensive Momentum handler
	return handler(
		event,
		{
			readBody,
			getQuery,
			getRouterParams,
			setResponseStatus,
			setResponseHeader,
			readMultipartFormData,
			send,
		},
		{ user },
	);
});

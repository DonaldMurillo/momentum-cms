/**
 * DELETE /api/auth/api-keys/:id — delete an API key.
 *
 * Admin can delete any key; non-admin can only delete their own.
 */

import { defineEventHandler, getRouterParam, getHeaders, setResponseStatus } from 'h3';
import {
	createAdapterApiKeyStore,
	isValidApiKeyFormat,
	hashApiKey,
} from '@momentum-cms/server-core';
import { ensureInitialized, getAuth } from '../../../../utils/momentum-init';
import momentumConfig from '../../../../../momentum.config';

let store: ReturnType<typeof createAdapterApiKeyStore> | null = null;

function getStore(): ReturnType<typeof createAdapterApiKeyStore> {
	if (!store) {
		store = createAdapterApiKeyStore(momentumConfig.db.adapter);
	}
	return store;
}

/**
 * Resolve user from API key header or session cookie.
 */
async function resolveUser(
	rawHeaders: Record<string, string | undefined>,
): Promise<{ id: string; role?: string } | null> {
	// 1. Try API key auth first
	const apiKeyHeader = rawHeaders['x-api-key'];
	if (apiKeyHeader && typeof apiKeyHeader === 'string' && isValidApiKeyFormat(apiKeyHeader)) {
		try {
			const apiKeyStore = getStore();
			const keyHash = hashApiKey(apiKeyHeader);
			const record = await apiKeyStore.findByHash(keyHash);
			if (record) {
				if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
					return null;
				}
				apiKeyStore.updateLastUsed(record.id, new Date().toISOString()).catch(() => {
					// Silently ignore — non-critical update
				});
				return {
					id: `apikey:${record.id}`,
					role: record.role,
				};
			}
		} catch {
			// Fall through to session auth
		}
	}

	// 2. Try session auth
	const auth = getAuth();
	if (!auth) return null;

	try {
		const headers = new Headers();
		for (const [key, value] of Object.entries(rawHeaders)) {
			if (value != null) {
				headers.set(key, value);
			}
		}
		const session = await auth.api.getSession({ headers });
		if (!session) return null;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth user type
		const userRecord = session.user as Record<string, unknown>;
		return {
			id: session.user.id,
			role: typeof userRecord['role'] === 'string' ? userRecord['role'] : 'user',
		};
	} catch {
		return null;
	}
}

export default defineEventHandler(async (event) => {
	await ensureInitialized();

	const rawHeaders = getHeaders(event);
	const user = await resolveUser(rawHeaders);
	if (!user) {
		setResponseStatus(event, 401);
		return { error: 'Unauthorized' };
	}

	const keyId = getRouterParam(event, 'id');
	if (!keyId) {
		setResponseStatus(event, 400);
		return { error: 'Key ID required' };
	}

	const apiKeyStore = getStore();

	// Non-admin users can only delete their own keys
	if (user.role !== 'admin') {
		const existingKey = await apiKeyStore.findById(keyId);
		if (!existingKey) {
			setResponseStatus(event, 404);
			return { error: 'API key not found' };
		}
		if (existingKey.createdBy !== user.id) {
			setResponseStatus(event, 403);
			return { error: 'You can only delete your own API keys' };
		}
	}

	try {
		const deleted = await apiKeyStore.deleteById(keyId);
		if (deleted) {
			return { deleted: true };
		}
		setResponseStatus(event, 404);
		return { error: 'API key not found' };
	} catch {
		setResponseStatus(event, 500);
		return { error: 'Failed to delete API key' };
	}
});

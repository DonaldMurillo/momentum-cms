/**
 * API Key Management routes for the Analog server.
 *
 * Mirrors Express's createApiKeyRoutes:
 * - GET  /api/auth/api-keys     — list API keys (admin: all, others: own)
 * - POST /api/auth/api-keys     — create a new API key
 *
 * Route priority: This specific file matches before the auth catch-all [...auth].ts,
 * ensuring API key management doesn't fall through to Better Auth.
 */

import { defineEventHandler, getMethod, readBody, getHeaders, setResponseStatus } from 'h3';
import {
	createAdapterApiKeyStore,
	generateApiKey,
	hashApiKey,
	getKeyPrefix,
	generateApiKeyId,
	isValidApiKeyFormat,
} from '@momentum-cms/server-core';
import { ensureInitialized, getAuth } from '../../../utils/momentum-init';
import momentumConfig from '../../../../momentum.config';

/** Role hierarchy for permission checks. Lower index = higher privilege. */
const ROLE_HIERARCHY = ['admin', 'editor', 'user', 'viewer'];

let store: ReturnType<typeof createAdapterApiKeyStore> | null = null;

function getStore(): ReturnType<typeof createAdapterApiKeyStore> {
	if (!store) {
		store = createAdapterApiKeyStore(momentumConfig.db.adapter);
	}
	return store;
}

/**
 * Resolve user from API key header or session cookie.
 * API key auth is checked first (matches Express middleware order).
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
					return null; // expired
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

	const method = getMethod(event);
	const rawHeaders = getHeaders(event);

	const user = await resolveUser(rawHeaders);
	if (!user) {
		setResponseStatus(event, 401);
		return { error: 'Unauthorized' };
	}

	const apiKeyStore = getStore();

	// GET /api/auth/api-keys — list API keys
	if (method === 'GET') {
		try {
			const keys =
				user.role === 'admin' ? await apiKeyStore.listAll() : await apiKeyStore.listByUser(user.id);
			return { keys };
		} catch {
			setResponseStatus(event, 500);
			return { error: 'Failed to list API keys' };
		}
	}

	// POST /api/auth/api-keys — create a new API key
	if (method === 'POST') {
		// API keys cannot create other API keys
		if (user.id.startsWith('apikey:')) {
			setResponseStatus(event, 403);
			return { error: 'API keys cannot create other API keys' };
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- h3 body
		const body = (await readBody(event)) as Record<string, unknown>;
		const name = body['name'];

		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			setResponseStatus(event, 400);
			return { error: 'Name is required' };
		}

		const role = typeof body['role'] === 'string' ? body['role'] : 'user';
		const validRoles = ['admin', 'editor', 'user', 'viewer'];
		if (!validRoles.includes(role)) {
			setResponseStatus(event, 400);
			return { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` };
		}

		// Non-admin users cannot create keys with a higher role than their own
		const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role ?? 'viewer');
		if (user.role !== 'admin' && userRoleIndex === -1) {
			setResponseStatus(event, 403);
			return { error: 'Unknown role — cannot determine privileges' };
		}
		const requestedRoleIndex = ROLE_HIERARCHY.indexOf(role);
		if (user.role !== 'admin' && requestedRoleIndex < userRoleIndex) {
			setResponseStatus(event, 403);
			return { error: 'Cannot create a key with higher privileges than your own role' };
		}

		// Validate expiresAt if provided
		let expiresAt: string | null = null;
		if (body['expiresAt'] != null) {
			const parsed = new Date(String(body['expiresAt']));
			if (isNaN(parsed.getTime())) {
				setResponseStatus(event, 400);
				return { error: 'Invalid expiresAt date format. Use ISO 8601.' };
			}
			expiresAt = parsed.toISOString();
		}

		try {
			const key = generateApiKey();
			const id = generateApiKeyId();
			const now = new Date().toISOString();

			const createdId = await apiKeyStore.create({
				id,
				name: name.trim(),
				keyHash: hashApiKey(key),
				keyPrefix: getKeyPrefix(key),
				createdBy: user.id,
				role,
				expiresAt,
				createdAt: now,
				updatedAt: now,
			});

			setResponseStatus(event, 201);
			return {
				id: createdId,
				name: name.trim(),
				key,
				keyPrefix: getKeyPrefix(key),
				role,
				expiresAt,
				createdAt: now,
			};
		} catch {
			setResponseStatus(event, 500);
			return { error: 'Failed to create API key' };
		}
	}

	// DELETE is handled by api-keys/[id].ts
	setResponseStatus(event, 405);
	return { error: 'Method not allowed' };
});

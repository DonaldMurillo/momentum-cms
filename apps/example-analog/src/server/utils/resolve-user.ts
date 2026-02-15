/**
 * Shared user resolution utilities for Analog route handlers.
 *
 * Two variants:
 * - resolveUserFromSession() — session-only auth (e.g., analytics)
 * - resolveUserFromRequest() — API key first, then session fallback (e.g., API key management)
 */

import { isValidApiKeyFormat, hashApiKey } from '@momentum-cms/server-core';
import { getAuth } from './momentum-init';

/** Minimal interface for the API key store operations needed during user resolution. */
interface ApiKeyStoreLike {
	findByHash(hash: string): Promise<{
		id: string;
		expiresAt?: string | null;
		role: string;
	} | null>;
	updateLastUsed(id: string, timestamp: string): Promise<void>;
}

/** Resolved user identity. */
export interface ResolvedUser {
	id: string;
	role?: string;
}

/**
 * Convert raw h3 headers into a `Headers` instance for Better Auth.
 */
function toHeaders(rawHeaders: Record<string, string | undefined>): Headers {
	const headers = new Headers();
	for (const [key, value] of Object.entries(rawHeaders)) {
		if (value != null) {
			headers.set(key, value);
		}
	}
	return headers;
}

/**
 * Resolve user from session cookie only.
 * Use this for endpoints that should not accept API key auth.
 */
export async function resolveUserFromSession(
	rawHeaders: Record<string, string | undefined>,
): Promise<ResolvedUser | null> {
	const auth = getAuth();
	if (!auth) return null;

	try {
		const session = await auth.api.getSession({ headers: toHeaders(rawHeaders) });
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

/**
 * Resolve user from API key header first, then fall back to session cookie.
 * Use this for endpoints that accept both authentication methods.
 */
export async function resolveUserFromRequest(
	rawHeaders: Record<string, string | undefined>,
	apiKeyStore: ApiKeyStoreLike,
): Promise<ResolvedUser | null> {
	// 1. Try API key auth first
	const apiKeyHeader = rawHeaders['x-api-key'];
	if (apiKeyHeader && typeof apiKeyHeader === 'string' && isValidApiKeyFormat(apiKeyHeader)) {
		try {
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
	return resolveUserFromSession(rawHeaders);
}

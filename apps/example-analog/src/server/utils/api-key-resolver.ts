import {
	hashApiKey,
	isValidApiKeyFormat,
	normalizeApiKeyRole,
	type ApiKeyStore,
} from '@momentumcms/server-core';

export interface ResolvedApiKeyUser {
	id: string;
	email: string;
	role: string;
}

export type ApiKeyResolution =
	| { status: 'absent' }
	| { status: 'ok'; user: ResolvedApiKeyUser }
	| { status: 'rejected'; code: number; error: string };

/**
 * Resolve a user from the X-API-Key request header.
 *
 * Returns:
 * - `absent` when the header is missing or not a single string — caller should
 *   fall through to other auth methods (e.g. session cookie).
 * - `ok` with the user context when the key is valid and unexpired.
 * - `rejected` with an HTTP status when the header was supplied but the key is
 *   invalid, missing, or expired. Callers must short-circuit and respond with
 *   the given status; matches the Express `createApiKeyResolverMiddleware`
 *   behavior so a leaked or stale key produces a deterministic 401 instead of
 *   silently degrading to session auth.
 */
export async function resolveApiKeyFromHeaders(
	headers: Record<string, string | string[] | undefined>,
	store: ApiKeyStore,
): Promise<ApiKeyResolution> {
	const raw = headers['x-api-key'];
	if (!raw || typeof raw !== 'string') return { status: 'absent' };

	if (!isValidApiKeyFormat(raw)) {
		return { status: 'rejected', code: 401, error: 'Invalid API key format' };
	}

	let record;
	try {
		record = await store.findByHash(hashApiKey(raw));
	} catch {
		return { status: 'rejected', code: 500, error: 'API key validation failed' };
	}

	if (!record) {
		return { status: 'rejected', code: 401, error: 'Invalid API key' };
	}

	if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
		return { status: 'rejected', code: 401, error: 'API key expired' };
	}

	store.updateLastUsed(record.id, new Date().toISOString()).catch(() => {
		/* non-critical */
	});

	return {
		status: 'ok',
		user: {
			id: `apikey:${record.id}`,
			email: `apikey-${record.name}@system`,
			role: normalizeApiKeyRole(record.role),
		},
	};
}

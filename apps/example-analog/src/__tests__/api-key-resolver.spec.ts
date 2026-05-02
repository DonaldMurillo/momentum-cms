import { describe, it, expect, vi } from 'vitest';
import { hashApiKey } from '@momentumcms/server-core';
import type { ApiKeyStore } from '@momentumcms/server-core';
import { resolveApiKeyFromHeaders } from '../server/utils/api-key-resolver';

const VALID_KEY = `mcms_${'a'.repeat(40)}`;

function makeStore(record: unknown = null): ApiKeyStore {
	return {
		findByHash: vi.fn().mockResolvedValue(record),
		updateLastUsed: vi.fn().mockResolvedValue(undefined),
	} as unknown as ApiKeyStore;
}

function makeRecord(overrides: Record<string, unknown> = {}) {
	return {
		id: 'rec-1',
		name: 'test-key',
		keyHash: hashApiKey(VALID_KEY),
		role: 'admin',
		expiresAt: null,
		...overrides,
	};
}

describe('resolveApiKeyFromHeaders', () => {
	it('returns absent when header is missing', async () => {
		const result = await resolveApiKeyFromHeaders({}, makeStore());
		expect(result.status).toBe('absent');
	});

	it('returns absent when header value is not a string', async () => {
		const result = await resolveApiKeyFromHeaders({ 'x-api-key': ['multi', 'value'] }, makeStore());
		expect(result.status).toBe('absent');
	});

	it('rejects with 401 when header is present but format is invalid', async () => {
		const result = await resolveApiKeyFromHeaders({ 'x-api-key': 'not-a-real-key' }, makeStore());
		expect(result.status).toBe('rejected');
		if (result.status === 'rejected') {
			expect(result.code).toBe(401);
			expect(result.error).toMatch(/format/i);
		}
	});

	it('rejects with 401 when header is valid format but no matching record exists', async () => {
		const result = await resolveApiKeyFromHeaders({ 'x-api-key': VALID_KEY }, makeStore(null));
		expect(result.status).toBe('rejected');
		if (result.status === 'rejected') {
			expect(result.code).toBe(401);
		}
	});

	it('rejects with 401 when key has expired', async () => {
		const yesterday = new Date(Date.now() - 86400_000).toISOString();
		const store = makeStore(makeRecord({ expiresAt: yesterday }));
		const result = await resolveApiKeyFromHeaders({ 'x-api-key': VALID_KEY }, store);
		expect(result.status).toBe('rejected');
		if (result.status === 'rejected') {
			expect(result.code).toBe(401);
			expect(result.error).toMatch(/expired/i);
		}
	});

	it('returns ok with user context for a valid, unexpired key', async () => {
		const store = makeStore(makeRecord());
		const result = await resolveApiKeyFromHeaders({ 'x-api-key': VALID_KEY }, store);
		expect(result.status).toBe('ok');
		if (result.status === 'ok') {
			expect(result.user.id).toBe('apikey:rec-1');
			expect(result.user.role).toBe('admin');
			expect(result.user.email).toContain('apikey-test-key');
		}
	});

	it('falls back to "user" role when the record role is empty/missing', async () => {
		const store = makeStore(makeRecord({ role: '' }));
		const result = await resolveApiKeyFromHeaders({ 'x-api-key': VALID_KEY }, store);
		expect(result.status).toBe('ok');
		if (result.status === 'ok') {
			expect(result.user.role).toBe('user');
		}
	});

	it('updates lastUsed on successful resolution (fire and forget)', async () => {
		const store = makeStore(makeRecord());
		await resolveApiKeyFromHeaders({ 'x-api-key': VALID_KEY }, store);
		expect(store.updateLastUsed).toHaveBeenCalledWith('rec-1', expect.any(String));
	});

	it('still returns ok when updateLastUsed rejects (proves the .catch swallows)', async () => {
		// Without the .catch swallow, this rejection would surface as an unhandled
		// promise rejection and either fail the test or crash the process.
		const store = {
			findByHash: vi.fn().mockResolvedValue(makeRecord()),
			updateLastUsed: vi.fn().mockRejectedValue(new Error('lastUsed write failed')),
		} as unknown as ApiKeyStore;
		const unhandled: unknown[] = [];
		const onUnhandled = (err: unknown) => unhandled.push(err);
		process.on('unhandledRejection', onUnhandled);
		try {
			const result = await resolveApiKeyFromHeaders({ 'x-api-key': VALID_KEY }, store);
			// Let the rejected updateLastUsed promise settle so unhandled handler can fire.
			await new Promise((r) => setImmediate(r));
			expect(result.status).toBe('ok');
			expect(unhandled).toHaveLength(0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	it('returns rejected with 500 when the store throws unexpectedly', async () => {
		const store = {
			findByHash: vi.fn().mockRejectedValue(new Error('db down')),
			updateLastUsed: vi.fn(),
		} as unknown as ApiKeyStore;
		const result = await resolveApiKeyFromHeaders({ 'x-api-key': VALID_KEY }, store);
		expect(result.status).toBe('rejected');
		if (result.status === 'rejected') {
			expect(result.code).toBe(500);
		}
	});
});

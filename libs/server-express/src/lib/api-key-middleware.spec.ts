import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApiKeyRoutes, createApiKeyResolverMiddleware } from './api-key-middleware';
import { hashApiKey } from '@momentumcms/server-core';
import type { ApiKeyStore } from '@momentumcms/server-core';

/**
 * Creates a mock ApiKeyStore with all methods stubbed.
 */
function createMockStore(): ApiKeyStore {
	return {
		create: vi.fn().mockResolvedValue('new-key-id'),
		findByHash: vi.fn().mockResolvedValue(null),
		listAll: vi.fn().mockResolvedValue([]),
		listByUser: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		deleteById: vi.fn().mockResolvedValue(true),
		updateLastUsed: vi.fn().mockResolvedValue(undefined),
	};
}

/**
 * Creates an Express app with the API key routes mounted,
 * injecting a fake user into req.user via middleware.
 */
function createApp(store: ApiKeyStore, user?: { id: string; role?: string }): express.Application {
	const app = express();
	app.use(express.json());

	// Inject fake authenticated user
	if (user) {
		app.use((req, _res, next) => {
			(req as any).user = user;
			next();
		});
	}

	app.use(createApiKeyRoutes({ store }));
	return app;
}

describe('createApiKeyRoutes - role hierarchy privilege escalation', () => {
	let store: ApiKeyStore;

	beforeEach(() => {
		store = createMockStore();
	});

	it('should allow an editor to create a key with role "editor" (same level)', async () => {
		const app = createApp(store, { id: 'user-1', role: 'editor' });

		const res = await request(app).post('/api-keys').send({ name: 'my-key', role: 'editor' });

		expect(res.status).toBe(201);
	});

	it('should allow an editor to create a key with role "user" (lower privilege)', async () => {
		const app = createApp(store, { id: 'user-1', role: 'editor' });

		const res = await request(app).post('/api-keys').send({ name: 'my-key', role: 'user' });

		expect(res.status).toBe(201);
	});

	it('should reject an editor creating a key with role "admin" (higher privilege)', async () => {
		const app = createApp(store, { id: 'user-1', role: 'editor' });

		const res = await request(app).post('/api-keys').send({ name: 'my-key', role: 'admin' });

		expect(res.status).toBe(403);
		expect(res.body.error).toContain('Cannot create a key with higher privileges');
		expect(store.create).not.toHaveBeenCalled();
	});

	it('should reject a user with an unknown role from creating any key', async () => {
		const app = createApp(store, { id: 'user-1', role: 'corrupted' });

		const res = await request(app).post('/api-keys').send({ name: 'escalated-key', role: 'admin' });

		expect(res.status).toBe(403);
		expect(store.create).not.toHaveBeenCalled();
	});

	it('should reject a user with undefined role from creating admin keys', async () => {
		const app = createApp(store, { id: 'user-1', role: undefined });

		const res = await request(app).post('/api-keys').send({ name: 'escalated-key', role: 'admin' });

		expect(res.status).toBe(403);
		expect(res.body.error).toContain('Cannot create a key with higher privileges');
		expect(store.create).not.toHaveBeenCalled();
	});

	it('should reject a user with empty string role from creating editor keys', async () => {
		const app = createApp(store, { id: 'user-1', role: '' });

		const res = await request(app)
			.post('/api-keys')
			.send({ name: 'escalated-key', role: 'editor' });

		expect(res.status).toBe(403);
		expect(store.create).not.toHaveBeenCalled();
	});
});

describe('createApiKeyRoutes - API key ID enumeration prevention', () => {
	let store: ApiKeyStore;

	beforeEach(() => {
		store = createMockStore();
	});

	it('should return 404 (not 403) when non-admin tries to delete another users key', async () => {
		// Key exists but belongs to user-A
		vi.mocked(store.findById).mockResolvedValue({
			id: 'key-123',
			name: 'Other Key',
			keyPrefix: 'mk_abc',
			keyHash: 'hash',
			role: 'editor',
			createdBy: 'user-A',
			createdAt: new Date(),
			expiresAt: null,
			lastUsedAt: null,
		});

		const app = createApp(store, { id: 'user-B', role: 'editor' });

		const res = await request(app).delete('/api-keys/key-123');

		// Should return 404, NOT 403 — to prevent enumeration
		expect(res.status).toBe(404);
		expect(res.body.error).toBe('API key not found');
	});

	it('should return identical response for non-existent key and another users key', async () => {
		const app = createApp(store, { id: 'user-B', role: 'editor' });

		// Case 1: key doesn't exist
		vi.mocked(store.findById).mockResolvedValue(null);
		const notFoundRes = await request(app).delete('/api-keys/nonexistent');

		// Case 2: key exists but belongs to someone else
		vi.mocked(store.findById).mockResolvedValue({
			id: 'key-123',
			name: 'Other Key',
			keyPrefix: 'mk_abc',
			keyHash: 'hash',
			role: 'editor',
			createdBy: 'user-A',
			createdAt: new Date(),
			expiresAt: null,
			lastUsedAt: null,
		});
		const forbiddenRes = await request(app).delete('/api-keys/key-123');

		// Both should return identical status and body
		expect(notFoundRes.status).toBe(forbiddenRes.status);
		expect(notFoundRes.body).toEqual(forbiddenRes.body);
	});
});

describe('createApiKeyResolverMiddleware - role normalization', () => {
	function createResolverApp(store: ApiKeyStore): {
		app: express.Application;
		captured: { user?: { id: string; role?: string } };
	} {
		const captured: { user?: { id: string; role?: string } } = {};
		const app = express();
		app.use(createApiKeyResolverMiddleware({ store }));
		app.get('/whoami', (req, res) => {
			captured.user = (req as unknown as { user?: { id: string; role?: string } }).user;
			res.status(200).json({ ok: true });
		});
		return { app, captured };
	}

	const validApiKey = `mcms_${'a'.repeat(40)}`;

	function makeRecord(role: unknown) {
		return {
			id: 'rec-1',
			name: 'test-key',
			keyPrefix: 'mcms_aaaa',
			keyHash: hashApiKey(validApiKey),

			role: role as string,
			createdBy: 'user-1',
			createdAt: new Date(),
			expiresAt: null,
			lastUsedAt: null,
		};
	}

	it('should pass through a valid string role', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeRecord('admin'));
		const { app, captured } = createResolverApp(store);

		await request(app).get('/whoami').set('x-api-key', validApiKey);

		expect(captured.user?.role).toBe('admin');
	});

	it('should fall back to "user" when role is undefined', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeRecord(undefined));
		const { app, captured } = createResolverApp(store);

		await request(app).get('/whoami').set('x-api-key', validApiKey);

		expect(captured.user?.role).toBe('user');
	});

	it('should fall back to "user" when role is null', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeRecord(null));
		const { app, captured } = createResolverApp(store);

		await request(app).get('/whoami').set('x-api-key', validApiKey);

		expect(captured.user?.role).toBe('user');
	});

	it('should fall back to "user" when role is an empty string', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeRecord(''));
		const { app, captured } = createResolverApp(store);

		await request(app).get('/whoami').set('x-api-key', validApiKey);

		expect(captured.user?.role).toBe('user');
	});
});

describe('createApiKeyResolverMiddleware - expiration guards', () => {
	const validApiKey = `mcms_${'a'.repeat(40)}`;

	function makeExpiryRecord(expiresAt: string | null) {
		return {
			id: 'rec-1',
			name: 'test-key',
			keyPrefix: 'mcms_aaaa',
			keyHash: hashApiKey(validApiKey),
			role: 'admin',
			createdBy: 'user-1',
			createdAt: new Date(),
			expiresAt,
			lastUsedAt: null,
		};
	}

	function createResolverApp(store: ApiKeyStore) {
		const app = express();
		app.use(createApiKeyResolverMiddleware({ store }));
		app.get('/test', (req, res) => {
			res.status(200).json({ ok: true });
		});
		return app;
	}

	it('rejects API key with NaN-inducing expiresAt ("not-a-date")', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeExpiryRecord('not-a-date'));
		const app = createResolverApp(store);

		const res = await request(app).get('/test').set('x-api-key', validApiKey);
		expect(res.status).toBe(401);
		expect(res.body.error).toMatch(/invalid expiration/i);
	});

	it('rejects API key with NaN-inducing expiresAt (empty string)', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeExpiryRecord(''));
		// new Date('') returns Invalid Date (NaN)
		const app = createResolverApp(store);

		const res = await request(app).get('/test').set('x-api-key', validApiKey);
		expect(res.status).toBe(401);
	});

	it('rejects expired API key (past date)', async () => {
		const store = createMockStore();
		const pastDate = new Date(Date.now() - 86400000).toISOString();
		vi.mocked(store.findByHash).mockResolvedValue(makeExpiryRecord(pastDate));
		const app = createResolverApp(store);

		const res = await request(app).get('/test').set('x-api-key', validApiKey);
		expect(res.status).toBe(401);
		expect(res.body.error).toMatch(/expired/i);
	});

	it('allows API key with null expiresAt (never expires)', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeExpiryRecord(null));
		const app = createResolverApp(store);

		const res = await request(app).get('/test').set('x-api-key', validApiKey);
		expect(res.status).toBe(200);
	});

	it('allows API key with future expiresAt', async () => {
		const store = createMockStore();
		const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
		vi.mocked(store.findByHash).mockResolvedValue(makeExpiryRecord(futureDate));
		const app = createResolverApp(store);

		const res = await request(app).get('/test').set('x-api-key', validApiKey);
		expect(res.status).toBe(200);
	});

	it('rejects API key with Infinity as expiresAt', async () => {
		const store = createMockStore();
		// Infinity coerces to NaN via new Date(Infinity).getTime() → NaN
		vi.mocked(store.findByHash).mockResolvedValue(makeExpiryRecord('Infinity'));
		const app = createResolverApp(store);

		const res = await request(app).get('/test').set('x-api-key', validApiKey);
		expect(res.status).toBe(401);
		expect(res.body.error).toMatch(/invalid expiration/i);
	});

	it('rejects API key with epoch (1970-01-01) as expiresAt', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeExpiryRecord('1970-01-01T00:00:00.000Z'));
		const app = createResolverApp(store);

		const res = await request(app).get('/test').set('x-api-key', validApiKey);
		expect(res.status).toBe(401);
		expect(res.body.error).toMatch(/expired/i);
	});

	it('returns 500 when store.findByHash throws a database error', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockRejectedValue(new Error('Connection refused'));
		const app = createResolverApp(store);

		const res = await request(app).get('/test').set('x-api-key', validApiKey);
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('API key validation failed');
	});
});

describe('createApiKeyResolverMiddleware - array header normalization', () => {
	const validApiKey = `mcms_${'a'.repeat(40)}`;

	function makeValidRecord() {
		return {
			id: 'rec-1',
			name: 'test-key',
			keyPrefix: 'mcms_aaaa',
			keyHash: hashApiKey(validApiKey),
			role: 'admin',
			createdBy: 'user-1',
			createdAt: new Date(),
			expiresAt: null,
			lastUsedAt: null,
		};
	}

	it('uses first value from array-valued X-API-Key header', async () => {
		const store = createMockStore();
		vi.mocked(store.findByHash).mockResolvedValue(makeValidRecord());

		const captured: { user?: { id?: string } } = {};
		const app = express();
		app.use(createApiKeyResolverMiddleware({ store }));
		app.get('/test', (req, res) => {
			captured.user = (req as unknown as { user?: { id?: string } }).user;
			res.status(200).json({ ok: true });
		});

		// Simulate Express parsing duplicate X-API-Key headers into string[]
		// supertest doesn't support array headers directly, so we use a raw middleware test
		app.get(
			'/test-array',
			(req, res, next) => {
				// Simulate Express array header behavior
				(req.headers as Record<string, unknown>)['x-api-key'] = [validApiKey, 'mcms_invalid'];
				next();
			},
			createApiKeyResolverMiddleware({ store }),
			(req, res) => {
				captured.user = (req as unknown as { user?: { id?: string } }).user;
				res.status(200).json({ ok: true });
			},
		);

		const res = await request(app).get('/test-array');
		expect(res.status).toBe(200);
		expect(captured.user?.id).toBe('apikey:rec-1');
	});
});

describe('createApiKeyRoutes - non-admin delete error handling', () => {
	it('returns 500 when store.findById throws for non-admin delete', async () => {
		const store = createMockStore();
		vi.mocked(store.findById).mockRejectedValue(new Error('DB connection lost'));
		const app = createApp(store, { id: 'user-1', role: 'editor' });

		const res = await request(app).delete('/api-keys/key-123');

		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to verify API key ownership');
	});
});

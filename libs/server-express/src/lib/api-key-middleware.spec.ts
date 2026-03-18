import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApiKeyRoutes } from './api-key-middleware';
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

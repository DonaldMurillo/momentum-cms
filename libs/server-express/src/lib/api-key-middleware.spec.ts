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
	});

	it('should reject a user with an unknown role from creating any key', async () => {
		// BUG: If user.role is not in ROLE_HIERARCHY, indexOf returns -1.
		// No valid requestedRoleIndex is < -1, so the guard is bypassed.
		// A user with role "corrupted" should NOT be able to create admin keys.
		const app = createApp(store, { id: 'user-1', role: 'corrupted' });

		const res = await request(app).post('/api-keys').send({ name: 'escalated-key', role: 'admin' });

		// This SHOULD be 403, but the current code allows it (returns 201)
		expect(res.status).toBe(403);
	});

	it('should reject a user with undefined role from creating admin keys', async () => {
		// When user.role is undefined, it falls back to 'viewer' via ?? 'viewer'
		// This case should work correctly, but let's verify
		const app = createApp(store, { id: 'user-1', role: undefined });

		const res = await request(app).post('/api-keys').send({ name: 'escalated-key', role: 'admin' });

		expect(res.status).toBe(403);
		expect(res.body.error).toContain('Cannot create a key with higher privileges');
	});

	it('should reject a user with empty string role from creating editor keys', async () => {
		// Empty string is not in ROLE_HIERARCHY → indexOf returns -1
		const app = createApp(store, { id: 'user-1', role: '' });

		const res = await request(app)
			.post('/api-keys')
			.send({ name: 'escalated-key', role: 'editor' });

		// This SHOULD be 403
		expect(res.status).toBe(403);
	});
});

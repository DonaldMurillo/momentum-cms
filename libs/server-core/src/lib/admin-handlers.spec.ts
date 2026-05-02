import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type {
	CollectionConfig,
	GlobalConfig,
	MomentumConfig,
	UserContext,
} from '@momentumcms/core';
import {
	handleAccessRequest,
	handleStatusRequest,
	handleGetGlobalRequest,
	handleUpdateGlobalRequest,
} from './admin-handlers';
import { initializeMomentumAPI, resetMomentumAPI } from './momentum-api';
import { createInMemoryAdapter } from './server-core';

const adminUser: UserContext = { id: 'u-admin', role: 'admin' };
const regularUser: UserContext = { id: 'u-1', role: 'editor' };

describe('handleAccessRequest', () => {
	it('returns 200 with collection permissions for an authenticated user', async () => {
		const config: MomentumConfig = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'title', type: 'text' }],
				} as CollectionConfig,
			],
			db: { adapter: createInMemoryAdapter() },
		};

		const result = await handleAccessRequest({ config, user: adminUser });

		expect(result.status).toBe(200);
		expect(result.body.collections).toBeInstanceOf(Array);
		expect(result.body.collections[0]?.slug).toBe('posts');
	});

	it('returns 200 with permissions even when no user is supplied', async () => {
		const config: MomentumConfig = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'title', type: 'text' }],
					access: { read: () => true },
				} as CollectionConfig,
			],
			db: { adapter: createInMemoryAdapter() },
		};

		const result = await handleAccessRequest({ config });

		expect(result.status).toBe(200);
		expect(result.body.collections).toBeInstanceOf(Array);
	});
});

describe('handleStatusRequest', () => {
	let config: MomentumConfig;

	beforeEach(() => {
		resetMomentumAPI();
		config = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'title', type: 'text' }],
					versions: { drafts: true },
				} as CollectionConfig,
				{
					slug: 'tags',
					fields: [{ name: 'name', type: 'text' }],
				} as CollectionConfig,
			],
			db: { adapter: createInMemoryAdapter() },
		};
		initializeMomentumAPI(config);
	});

	afterEach(() => {
		resetMomentumAPI();
	});

	it('returns 400 when versioning is not enabled on the collection', async () => {
		const result = await handleStatusRequest({
			collectionSlug: 'tags',
			id: '1',
			user: adminUser,
		});

		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Versioning not enabled' });
	});

	it('returns 404 when the document does not exist', async () => {
		const result = await handleStatusRequest({
			collectionSlug: 'posts',
			id: 'nonexistent-id',
			user: adminUser,
		});

		expect(result.status).toBe(404);
		expect(result.body).toMatchObject({ error: 'Document not found' });
	});

	it('returns 200 with status info for an existing versioned doc', async () => {
		const { getMomentumAPI } = await import('./momentum-api');
		const api = getMomentumAPI();
		const created = await api.collection<{ title: string }>('posts').create({ title: 'Hello' });

		const result = await handleStatusRequest({
			collectionSlug: 'posts',
			id: String(created['id']),
			user: adminUser,
		});

		expect(result.status).toBe(200);
		const statusValue = (result.body as { status: unknown }).status;
		expect(typeof statusValue).toBe('string');
		expect(['draft', 'published']).toContain(statusValue);
	});

	it('returns 403 when access is denied', async () => {
		const lockedConfig: MomentumConfig = {
			collections: [
				{
					slug: 'secret',
					fields: [{ name: 'data', type: 'text' }],
					versions: { drafts: true },
					access: {
						read: ({ req }) => req.user?.role === 'admin',
						readVersions: ({ req }) => req.user?.role === 'admin',
					},
				} as CollectionConfig,
			],
			db: { adapter: createInMemoryAdapter() },
		};
		resetMomentumAPI();
		initializeMomentumAPI(lockedConfig);
		const { getMomentumAPI } = await import('./momentum-api');
		const api = getMomentumAPI().setContext({ user: adminUser });
		const created = await api.collection<{ data: string }>('secret').create({ data: 'classified' });

		const result = await handleStatusRequest({
			collectionSlug: 'secret',
			id: String(created['id']),
			user: regularUser,
		});

		expect(result.status).toBe(403);
		expect(result.body).toMatchObject({ error: 'Access denied' });
	});
});

describe('handleGetGlobalRequest / handleUpdateGlobalRequest', () => {
	const siteGlobal: GlobalConfig = {
		slug: 'site-settings',
		fields: [{ name: 'siteName', type: 'text', required: true }],
		access: {
			read: () => true,
			update: ({ req }) => req.user?.role === 'admin',
		},
	};

	beforeEach(() => {
		resetMomentumAPI();
		const config: MomentumConfig = {
			collections: [],
			globals: [siteGlobal],
			db: { adapter: createInMemoryAdapter() },
		};
		initializeMomentumAPI(config);
	});

	afterEach(() => {
		resetMomentumAPI();
	});

	it('returns 404 when the global slug does not exist', async () => {
		const result = await handleGetGlobalRequest({ slug: 'no-such-global' });
		expect(result.status).toBe(404);
		expect(result.body).toMatchObject({ error: expect.stringMatching(/not found/i) });
	});

	it('returns 403 when update is denied by access rules', async () => {
		const result = await handleUpdateGlobalRequest({
			slug: 'site-settings',
			data: { siteName: 'New Name' },
			user: regularUser,
		});
		expect(result.status).toBe(403);
		expect(result.body).toMatchObject({ error: 'Access denied' });
	});

	// Success and validation cases are exercised by global-operations.spec.ts
	// against a real adapter. The in-memory adapter does not implement
	// global storage, so we test the negative paths that short-circuit
	// before the adapter is invoked.
});

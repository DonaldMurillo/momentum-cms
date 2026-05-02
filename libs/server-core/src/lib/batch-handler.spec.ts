import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CollectionConfig, MomentumConfig, UserContext } from '@momentumcms/core';
import { handleBatchRequest, MAX_BATCH_SIZE } from './batch-handler';
import { initializeMomentumAPI, resetMomentumAPI } from './momentum-api';
import { createInMemoryAdapter } from './server-core';

const adminUser: UserContext = { id: 'u-admin', role: 'admin' };

const postsCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text' }],
};

const managedCollection: CollectionConfig = {
	slug: 'auth-user',
	fields: [{ name: 'email', type: 'text' }],
	managed: true,
};

function setup(): MomentumConfig {
	const config: MomentumConfig = {
		collections: [postsCollection, managedCollection],
		db: { adapter: createInMemoryAdapter() },
	};
	initializeMomentumAPI(config);
	return config;
}

describe('handleBatchRequest', () => {
	let config: MomentumConfig;

	beforeEach(() => {
		resetMomentumAPI();
		config = setup();
	});
	afterEach(() => resetMomentumAPI());

	it('returns 403 when the collection is managed (plugin-owned)', async () => {
		const result = await handleBatchRequest({
			config,
			collectionSlug: 'auth-user',
			body: { operation: 'delete', ids: ['1'] },
			user: adminUser,
		});
		expect(result.status).toBe(403);
		expect(result.body).toMatchObject({ error: 'Managed collection is read-only' });
	});

	it('returns 400 when the operation is not recognised', async () => {
		const result = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: { operation: 'foo' },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Invalid operation' });
	});

	it('returns 400 when create items is not an array', async () => {
		const result = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: { operation: 'create', items: 'oops' },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'items must be an array' });
	});

	it('returns 400 when delete ids is not an array', async () => {
		const result = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: { operation: 'delete', ids: null },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'ids must be an array' });
	});

	it('returns 400 when batch size exceeds the maximum', async () => {
		const items = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => ({
			title: `t-${i}`,
		}));
		const result = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: { operation: 'create', items },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({
			error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
		});
	});

	it('returns 201 with created docs for a successful create', async () => {
		const result = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: {
				operation: 'create',
				items: [{ title: 'one' }, { title: 'two' }, { title: 'three' }],
			},
			user: adminUser,
		});
		expect(result.status).toBe(201);
		expect(result.body).toMatchObject({ message: '3 documents created' });

		const body = result.body as { docs: Record<string, unknown>[] };
		expect(body.docs).toHaveLength(3);
		expect(body.docs[0]?.['title']).toBe('one');
		expect(body.docs[0]?.['id']).toBeDefined();
	});

	it('returns 200 with deleted results for a successful delete', async () => {
		// Seed docs first
		const seed = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: { operation: 'create', items: [{ title: 'a' }, { title: 'b' }] },
			user: adminUser,
		});

		const seeded = seed.body as { docs: { id: string }[] };
		const ids = seeded.docs.map((d) => d.id);

		const result = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: { operation: 'delete', ids },
			user: adminUser,
		});
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({ message: '2 documents deleted' });
	});

	it('returns 200 with updated docs for a successful update', async () => {
		const seed = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: { operation: 'create', items: [{ title: 'old-1' }, { title: 'old-2' }] },
			user: adminUser,
		});

		const seeded = seed.body as { docs: { id: string }[] };
		const items = seeded.docs.map((d) => ({ id: d.id, data: { title: `new-${d.id}` } }));

		const result = await handleBatchRequest({
			config,
			collectionSlug: 'posts',
			body: { operation: 'update', items },
			user: adminUser,
		});
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({ message: '2 documents updated' });

		const body = result.body as { docs: Record<string, unknown>[] };
		expect(body.docs[0]?.['title']).toMatch(/^new-/);
	});
});

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
});

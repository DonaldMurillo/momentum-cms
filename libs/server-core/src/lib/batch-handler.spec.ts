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

	describe('non-string IDs in delete batch', () => {
		it('returns 400 for numeric IDs instead of silently coercing', async () => {
			// ensureArrayOfIds now validates each element is a non-empty string
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'delete', ids: [123, 456] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/ids\[0\] must be a non-empty string/,
			);
		});

		it('returns 400 for null/undefined/boolean/object IDs', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'delete', ids: [null, true, false, undefined, {}, []] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/ids\[0\] must be a non-empty string/,
			);
		});

		it('returns 400 for empty string IDs', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'delete', ids: [''] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/ids\[0\] must be a non-empty string/,
			);
		});

		it('accepts valid string IDs', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'delete', ids: ['valid-id-1', 'valid-id-2'] },
				user: adminUser,
			});
			// Validation passes (not 400); adapter returns 404 because IDs don't exist
			expect(result.status).toBe(404);
		});
	});

	describe('missing or invalid operation', () => {
		it('returns 400 when operation field is missing entirely', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {},
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect(result.body).toMatchObject({ error: 'Invalid operation' });
		});

		it('returns 400 for uppercase operation "CREATE"', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'CREATE', items: [] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect(result.body).toMatchObject({ error: 'Invalid operation' });
		});

		it('returns 400 for "Delete" (mixed case)', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'Delete', ids: [] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
		});
	});

	describe('batch size boundary', () => {
		it('accepts exactly MAX_BATCH_SIZE items', async () => {
			const items = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => ({
				title: `boundary-${i}`,
			}));
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'create', items },
				user: adminUser,
			});
			expect(result.status).toBe(201);
			expect(result.body).toMatchObject({ message: `${MAX_BATCH_SIZE} documents created` });
		});

		it('accepts exactly MAX_BATCH_SIZE delete IDs without validation error', async () => {
			// The validation check passes (size <= MAX_BATCH_SIZE)
			// But since these IDs don't exist, the adapter returns 404
			const ids = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => `id-${i}`);
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'delete', ids },
				user: adminUser,
			});
			// Validation passed (not 400); adapter returns 404 because IDs don't exist
			expect(result.status).toBe(404);
		});
	});

	describe('prototype pollution via items', () => {
		it('does not pollute Object.prototype via __proto__ in create items', async () => {
			const before = Object.getPrototypeOf({}).admin;
			await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {
					operation: 'create',
					items: [{ __proto__: { admin: true } }],
				},
				user: adminUser,
			});
			const after = Object.getPrototypeOf({}).admin;
			expect(after).toBe(before); // undefined — not polluted
		});

		it('does not pollute Object.prototype via constructor in create items', async () => {
			const before = (Object.getPrototypeOf({}) as Record<string, unknown>).polluted;
			await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {
					operation: 'create',
					items: [{ constructor: { prototype: { polluted: 'yes' } } }],
				},
				user: adminUser,
			});
			const after = (Object.getPrototypeOf({}) as Record<string, unknown>).polluted;
			expect(after).toBe(before); // undefined — not polluted
		});
	});

	describe('whitespace-only string IDs', () => {
		it('returns 400 for whitespace-only string IDs in delete', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'delete', ids: ['   ', '\t', '\n'] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/ids\[0\] must be a non-empty string, got whitespace-only string/,
			);
		});

		it('returns 400 for whitespace-only string ID in update', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {
					operation: 'update',
					items: [{ id: '  ', data: { title: 'whitespace-id' } }],
				},
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/items\[0\]\.id must be a non-empty string \(whitespace-only string\)/,
			);
		});

		it('returns 400 for mixed whitespace ID in delete', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'delete', ids: ['  \t\n  '] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/ids\[0\] must be a non-empty string, got whitespace-only string/,
			);
		});
	});

	describe('toBatchUpdateItems edge cases', () => {
		it('returns 201 with empty docs for an empty create items array', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'create', items: [] },
				user: adminUser,
			});
			expect(result.status).toBe(201);
			expect(result.body).toMatchObject({ message: '0 documents created' });

			const body = result.body as { docs: Record<string, unknown>[] };
			expect(body.docs).toHaveLength(0);
		});

		it('returns 200 with empty results for an empty delete ids array', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'delete', ids: [] },
				user: adminUser,
			});
			expect(result.status).toBe(200);
			expect(result.body).toMatchObject({ message: '0 documents deleted' });
		});

		it('batch update with missing id field returns 400 validation error', async () => {
			// Item without 'id' key: toBatchUpdateItems rejects non-string ID
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {
					operation: 'update',
					items: [{ data: { title: 'no-id' } }],
				},
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/items\[0\]\.id must be a non-empty string \(missing\)/,
			);
		});

		it('batch update with null id returns 400 validation error', async () => {
			// id: null → toBatchUpdateItems rejects with clear error
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {
					operation: 'update',
					items: [{ id: null, data: { title: 'null-id' } }],
				},
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/items\[0\]\.id must be a non-empty string \(null\)/,
			);
		});

		it('batch update with numeric id returns 400 validation error', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {
					operation: 'update',
					items: [{ id: 123, data: { title: 'numeric-id' } }],
				},
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/items\[0\]\.id must be a non-empty string \(number\)/,
			);
		});

		it('batch update with empty string id returns 400 validation error', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {
					operation: 'update',
					items: [{ id: '', data: { title: 'empty-id' } }],
				},
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(
				/items\[0\]\.id must be a non-empty string \(empty string\)/,
			);
		});

		it('batch update with missing data field uses empty object', async () => {
			// Seed a doc first
			const seed = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'create', items: [{ title: 'original' }] },
				user: adminUser,
			});
			const seeded = seed.body as { docs: { id: string }[] };
			const docId = seeded.docs[0]?.id;
			expect(docId).toBeDefined();

			// Update with no data field → data is {} → doc unchanged
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: {
					operation: 'update',
					items: [{ id: docId }],
				},
				user: adminUser,
			});
			expect(result.status).toBe(200);
			const body = result.body as { docs: Record<string, unknown>[] };
			expect(body.docs).toHaveLength(1);
		});
	});

	describe('error status mapping', () => {
		it('returns 404 for unknown collection slug (CollectionNotFoundError)', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'nonexistent-collection',
				body: { operation: 'create', items: [{ title: 'test' }] },
				user: adminUser,
			});
			expect(result.status).toBe(404);
			expect((result.body as { error: string }).error).toMatch(/not found/i);
		});

		it('returns 404 for unknown collection slug on delete', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'does-not-exist',
				body: { operation: 'delete', ids: ['abc123'] },
				user: adminUser,
			});
			expect(result.status).toBe(404);
		});

		it('returns 404 for unknown collection slug on update', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'missing-slug',
				body: { operation: 'update', items: [{ id: 'x', data: {} }] },
				user: adminUser,
			});
			expect(result.status).toBe(404);
		});
	});

	describe('non-object primitives in create items', () => {
		it('returns 400 for numeric items', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'create', items: [123, 456] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(/items\[0\] must be an object/);
		});

		it('returns 400 for string items', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'create', items: ['hello'] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(/items\[0\] must be an object/);
		});

		it('returns 400 for null items', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'create', items: [null] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(/items\[0\] must be an object/);
		});

		it('returns 400 for boolean items', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'create', items: [true, false] },
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect((result.body as { error: string }).error).toMatch(/items\[0\] must be an object/);
		});

		it('accepts valid object items', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: { operation: 'create', items: [{ title: 'valid' }] },
				user: adminUser,
			});
			expect(result.status).toBe(201);
		});
	});

	describe('null/undefined body', () => {
		it('returns 400 when body is null', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: null as unknown as Record<string, unknown>,
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect(result.body).toMatchObject({
				error: 'Request body is required and must be an object',
			});
		});

		it('returns 400 when body is undefined', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: undefined as unknown as Record<string, unknown>,
				user: adminUser,
			});
			expect(result.status).toBe(400);
			expect(result.body).toMatchObject({
				error: 'Request body is required and must be an object',
			});
		});

		it('returns 400 when body is a string', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: 'invalid' as unknown as Record<string, unknown>,
				user: adminUser,
			});
			expect(result.status).toBe(400);
		});

		it('returns 400 when body is a number', async () => {
			const result = await handleBatchRequest({
				config,
				collectionSlug: 'posts',
				body: 42 as unknown as Record<string, unknown>,
				user: adminUser,
			});
			expect(result.status).toBe(400);
		});
	});
});

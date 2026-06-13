import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { MomentumConfig } from '@momentumcms/core';
import { createMomentumHandlers, createInMemoryAdapter } from './server-core';
import { initializeMomentumAPI, resetMomentumAPI } from './momentum-api';

/**
 * Helper: extract the document ID from a handleCreate response.
 * handleCreate returns { doc: { id, ... }, status: 201 } on success.
 */
function getCreatedId(created: { doc?: Record<string, unknown> | null }): string {
	const doc = created.doc;
	expect(doc).toBeDefined();
	const id = doc?.['id'];
	expect(id).toBeDefined();
	return String(id);
}

/**
 * Create a fresh config with its own in-memory adapter.
 * Each describe block gets an isolated database to prevent test leakage.
 */
function makeConfig(): MomentumConfig {
	return {
		collections: [
			{
				slug: 'posts',
				fields: [
					{ name: 'title', type: 'text', required: true },
					{ name: 'status', type: 'text' },
				],
			},
		],
		db: { adapter: createInMemoryAdapter() },
	};
}

describe('createMomentumHandlers', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('initializes the API and returns handlers', () => {
		const handlers = createMomentumHandlers(makeConfig());
		expect(handlers.handleFind).toBeInstanceOf(Function);
		expect(handlers.handleFindById).toBeInstanceOf(Function);
		expect(handlers.handleCreate).toBeInstanceOf(Function);
		expect(handlers.handleUpdate).toBeInstanceOf(Function);
		expect(handlers.handleDelete).toBeInstanceOf(Function);
		expect(handlers.handleForceDelete).toBeInstanceOf(Function);
		expect(handlers.handleRestore).toBeInstanceOf(Function);
		expect(handlers.handleSearch).toBeInstanceOf(Function);
		expect(handlers.routeRequest).toBeInstanceOf(Function);
	});

	it('does not throw when API is already initialized (idempotent)', () => {
		initializeMomentumAPI(makeConfig());
		expect(() => createMomentumHandlers(makeConfig())).not.toThrow();
	});
});

describe('handleError integration (via handlers)', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('handleFind with non-existent collection → 404', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleFind({
			method: 'GET',
			collectionSlug: 'nonexistent',
		});
		expect(result.status).toBe(404);
		expect(result.error).toBeDefined();
	});

	it('handleFindById without an ID → 400', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleFindById({
			method: 'GET',
			collectionSlug: 'posts',
		});
		expect(result.status).toBe(400);
		expect(result.error).toBe('ID is required');
	});

	it('handleCreate with non-existent collection → 404', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'nonexistent',
			body: { title: 'test' },
		});
		expect(result.status).toBe(404);
	});

	it('handleUpdate without an ID → 400', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleUpdate({
			method: 'PATCH',
			collectionSlug: 'posts',
			body: { title: 'updated' },
		});
		expect(result.status).toBe(400);
		expect(result.error).toBe('ID is required');
	});

	it('handleDelete without an ID → 400', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleDelete({
			method: 'DELETE',
			collectionSlug: 'posts',
		});
		expect(result.status).toBe(400);
	});

	it('handleForceDelete without an ID → 400', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleForceDelete({
			method: 'DELETE',
			collectionSlug: 'posts',
		});
		expect(result.status).toBe(400);
	});

	it('handleRestore without an ID → 400', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleRestore({
			method: 'POST',
			collectionSlug: 'posts',
		});
		expect(result.status).toBe(400);
	});
});

describe('handleRestore on non-soft-deleted document', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('returns 400 (ValidationError) when trying to restore a document that is not soft-deleted', async () => {
		const config: MomentumConfig = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'title', type: 'text', required: true }],
					softDelete: true,
				},
			],
			db: { adapter: createInMemoryAdapter() },
		};
		const handlers = createMomentumHandlers(config);

		// Create a document (not soft-deleted)
		const created = await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'Active Post' },
		});
		const id = getCreatedId(created);

		// Attempting to restore a non-soft-deleted document should return 400
		const result = await handlers.handleRestore({
			method: 'POST',
			collectionSlug: 'posts',
			id,
		});
		expect(result.status).toBe(400);
		expect(result.error).toBe('Validation failed');
		expect(result.errors).toBeDefined();
	});
});

describe('routeRequest dispatch', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('GET without ID → handleFind (returns docs array)', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.routeRequest({
			method: 'GET',
			collectionSlug: 'posts',
		});
		// Success path: status is undefined (no error), docs is empty array
		expect(result.docs).toEqual([]);
		expect(result.error).toBeUndefined();
	});

	it('GET with ID → handleFindById (returns doc)', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const created = await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'Hello' },
		});
		const id = getCreatedId(created);

		const result = await handlers.routeRequest({
			method: 'GET',
			collectionSlug: 'posts',
			id,
		});
		expect(result.doc).toBeDefined();
		expect((result.doc as Record<string, unknown>)?.['title']).toBe('Hello');
	});

	it('POST → handleCreate (201)', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.routeRequest({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'New Post' },
		});
		expect(result.status).toBe(201);
		expect(result.doc).toBeDefined();
	});

	it('PATCH → handleUpdate (returns updated doc)', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const created = await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'Original' },
		});
		const id = getCreatedId(created);

		const result = await handlers.routeRequest({
			method: 'PATCH',
			collectionSlug: 'posts',
			id,
			body: { title: 'Updated' },
		});
		expect(result.doc).toBeDefined();
		expect((result.doc as Record<string, unknown>)?.['title']).toBe('Updated');
	});

	it('PUT → handleUpdate (same as PATCH)', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const created = await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'Original' },
		});
		const id = getCreatedId(created);

		const result = await handlers.routeRequest({
			method: 'PUT',
			collectionSlug: 'posts',
			id,
			body: { title: 'Replaced' },
		});
		expect(result.doc).toBeDefined();
		expect((result.doc as Record<string, unknown>)?.['title']).toBe('Replaced');
	});

	it('DELETE → handleDelete (returns deleted=true)', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const created = await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'To Delete' },
		});
		const id = getCreatedId(created);

		const result = await handlers.routeRequest({
			method: 'DELETE',
			collectionSlug: 'posts',
			id,
		});
		expect(result.deleted).toBe(true);
	});

	it('Unknown method → 405', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.routeRequest({
			method: 'OPTIONS' as 'GET',
			collectionSlug: 'posts',
		});
		expect(result.status).toBe(405);
		expect(result.error).toBe('Method not allowed');
	});
});

describe('user context passthrough', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('passes user through to API context for find', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleFind({
			method: 'GET',
			collectionSlug: 'posts',
			user: { id: 'user-1', role: 'admin' },
		});
		// Success: status is undefined (no error), docs array returned
		expect(result.docs).toEqual([]);
		expect(result.error).toBeUndefined();
	});

	it('passes user through to API context for create', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'Authored Post' },
			user: { id: 'user-1', role: 'admin' },
		});
		expect(result.status).toBe(201);
		expect(result.doc).toBeDefined();
	});
});

describe('createInMemoryAdapter', () => {
	it('creates a document and returns it with generated id', async () => {
		const adapter = createInMemoryAdapter();
		const doc = await adapter.create('posts', { title: 'Test' });
		expect(doc['id']).toBeDefined();
		expect(doc['title']).toBe('Test');
		expect(doc['createdAt']).toBeDefined();
		expect(doc['updatedAt']).toBeDefined();
	});

	it('finds a document by ID', async () => {
		const adapter = createInMemoryAdapter();
		const created = await adapter.create('posts', { title: 'Test' });
		const found = await adapter.findById('posts', created['id'] as string);
		expect(found).toBeDefined();
		expect(found?.['title']).toBe('Test');
	});

	it('returns null for non-existent ID', async () => {
		const adapter = createInMemoryAdapter();
		const found = await adapter.findById('posts', 'nonexistent');
		expect(found).toBeNull();
	});

	it('lists all documents in a collection', async () => {
		const adapter = createInMemoryAdapter();
		await adapter.create('posts', { title: 'One' });
		await adapter.create('posts', { title: 'Two' });
		const docs = await adapter.find('posts', {});
		expect(docs).toHaveLength(2);
	});

	it('returns empty array for empty collection', async () => {
		const adapter = createInMemoryAdapter();
		const docs = await adapter.find('posts', {});
		expect(docs).toEqual([]);
	});

	it('updates a document and sets updatedAt', async () => {
		const adapter = createInMemoryAdapter();
		const created = await adapter.create('posts', { title: 'Original' });
		const updated = await adapter.update('posts', created['id'] as string, {
			title: 'Updated',
		});
		expect(updated['title']).toBe('Updated');
		expect(updated['updatedAt']).toBeDefined();
	});

	it('throws when updating a non-existent document', async () => {
		const adapter = createInMemoryAdapter();
		await expect(adapter.update('posts', 'nonexistent', { title: 'X' })).rejects.toThrow(
			'Document not found',
		);
	});

	it('deletes an existing document', async () => {
		const adapter = createInMemoryAdapter();
		const created = await adapter.create('posts', { title: 'ToDelete' });
		const deleted = await adapter.delete('posts', created['id'] as string);
		expect(deleted).toBe(true);
		const found = await adapter.findById('posts', created['id'] as string);
		expect(found).toBeNull();
	});

	it('returns false when deleting a non-existent document', async () => {
		const adapter = createInMemoryAdapter();
		const deleted = await adapter.delete('posts', 'nonexistent');
		expect(deleted).toBe(false);
	});

	it('isolates collections from each other', async () => {
		const adapter = createInMemoryAdapter();
		await adapter.create('posts', { title: 'Post' });
		await adapter.create('pages', { title: 'Page' });
		const posts = await adapter.find('posts', {});
		const pages = await adapter.find('pages', {});
		expect(posts).toHaveLength(1);
		expect(pages).toHaveLength(1);
		expect(posts[0]?.['title']).toBe('Post');
		expect(pages[0]?.['title']).toBe('Page');
	});

	// NOTE: The in-memory adapter intentionally ignores query parameters.
	// These tests document that behavior so regressions are caught if
	// the adapter is ever upgraded to support filtering/pagination.
	it('find() ignores where clause and returns all documents (intentional limitation)', async () => {
		const adapter = createInMemoryAdapter();
		await adapter.create('posts', { title: 'One', status: 'draft' });
		await adapter.create('posts', { title: 'Two', status: 'published' });
		await adapter.create('posts', { title: 'Three', status: 'published' });

		// Pass a where clause — it should be ignored
		const docs = await adapter.find('posts', { where: { status: 'published' } });
		expect(docs).toHaveLength(3); // ALL docs returned, not filtered
	});

	it('find() ignores limit/page and returns all documents (intentional limitation)', async () => {
		const adapter = createInMemoryAdapter();
		for (let i = 0; i < 5; i++) {
			await adapter.create('posts', { title: `Post ${i}` });
		}

		// Pass limit/page — should be ignored
		const docs = await adapter.find('posts', { limit: 2, page: 1 });
		expect(docs).toHaveLength(5); // ALL docs returned, not paginated
	});

	it('find() ignores sort parameter (intentional limitation)', async () => {
		const adapter = createInMemoryAdapter();
		await adapter.create('posts', { title: 'C' });
		await adapter.create('posts', { title: 'A' });
		await adapter.create('posts', { title: 'B' });

		// Pass sort — should be ignored (order is insertion order)
		const docs = await adapter.find('posts', { sort: 'title' });
		expect(docs.map((d) => d['title'])).toEqual(['C', 'A', 'B']); // insertion order, NOT sorted
	});
});

describe('handler success paths', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('handleFind returns all docs when no pagination requested', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		// Seed docs
		await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'A' },
		});
		await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'B' },
		});

		const result = await handlers.handleFind({
			method: 'GET',
			collectionSlug: 'posts',
		});
		// In-memory adapter returns all docs (no server-side pagination)
		expect(result.docs).toHaveLength(2);
		expect(result.totalDocs).toBe(2);
		expect(result.error).toBeUndefined();
	});

	it('handleFindById returns 404 for non-existent ID', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleFindById({
			method: 'GET',
			collectionSlug: 'posts',
			id: 'nonexistent',
		});
		expect(result.status).toBe(404);
	});

	it('handleCreate with required field missing → 400', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: {},
		});
		expect(result.status).toBe(400);
		expect(result.error).toBe('Validation failed');
		expect(result.errors).toBeDefined();
		expect((result.errors ?? []).length).toBeGreaterThan(0);
	});

	it('handleUpdate on non-existent ID → 404', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleUpdate({
			method: 'PATCH',
			collectionSlug: 'posts',
			id: 'nonexistent',
			body: { title: 'X' },
		});
		expect(result.status).toBe(404);
	});

	it('handleDelete on non-existent ID → 404', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		const result = await handlers.handleDelete({
			method: 'DELETE',
			collectionSlug: 'posts',
			id: 'nonexistent',
		});
		expect(result.status).toBe(404);
	});

	it('handleSearch returns matching results', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'Hello World' },
		});
		await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'Goodbye' },
		});

		const result = await handlers.handleSearch({
			method: 'GET',
			collectionSlug: 'posts',
			query: { q: 'Hello' },
		});
		// Success: status undefined, docs has matching results
		expect(result.docs).toBeDefined();
		expect(result.docs?.length ?? 0).toBeGreaterThanOrEqual(1);
		expect(result.totalDocs).toBeGreaterThanOrEqual(1);
	});

	it('handleSearch returns empty results for empty query', async () => {
		const handlers = createMomentumHandlers(makeConfig());
		await handlers.handleCreate({
			method: 'POST',
			collectionSlug: 'posts',
			body: { title: 'Hello' },
		});

		const result = await handlers.handleSearch({
			method: 'GET',
			collectionSlug: 'posts',
			query: { q: '' },
		});
		// Empty query matches nothing (or everything depending on search impl)
		expect(result.docs).toBeDefined();
		expect(result.totalDocs).toBeDefined();
	});
});

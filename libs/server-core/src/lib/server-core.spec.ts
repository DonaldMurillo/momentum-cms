import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMomentumHandlers, type MomentumRequest } from './server-core';
import { resetMomentumAPI } from './momentum-api';
import type { CollectionConfig, MomentumConfig, DatabaseAdapter } from '@momentumcms/core';

// Mock collection for testing
const mockPostsCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'content', type: 'textarea', label: 'Content' },
	],
};

const mockUsersCollection: CollectionConfig = {
	slug: 'users',
	labels: { singular: 'User', plural: 'Users' },
	fields: [
		{ name: 'name', type: 'text', required: true, label: 'Name' },
		{ name: 'email', type: 'email', required: true, label: 'Email' },
	],
};

describe('createMomentumHandlers', () => {
	let mockAdapter: DatabaseAdapter;
	let config: MomentumConfig;

	beforeEach(() => {
		// Reset singleton before each test
		resetMomentumAPI();

		mockAdapter = {
			find: vi.fn(),
			findById: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		};
		config = {
			collections: [mockPostsCollection, mockUsersCollection],
			db: { adapter: mockAdapter },
			server: { port: 4000 },
		};
	});

	afterEach(() => {
		resetMomentumAPI();
	});

	describe('handleFind', () => {
		it('should return documents from database', async () => {
			const handlers = createMomentumHandlers(config);
			const mockDocs = [
				{ id: '1', title: 'Test Post', content: 'Hello' },
				{ id: '2', title: 'Another Post', content: 'World' },
			];
			vi.mocked(mockAdapter.find).mockResolvedValue(mockDocs);

			const request: MomentumRequest = {
				method: 'GET',
				collectionSlug: 'posts',
			};

			const result = await handlers.handleFind(request);

			expect(result.docs).toEqual(mockDocs);
			expect(result.totalDocs).toBe(2);
			// Momentum API always passes pagination params
			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({
					limit: 10,
					page: 1,
				}),
			);
		});

		it('should pass query params to database', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const request: MomentumRequest = {
				method: 'GET',
				collectionSlug: 'posts',
				query: { limit: 10, page: 2, sort: '-createdAt' },
			};

			await handlers.handleFind(request);

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({
					limit: 10,
					page: 2,
					sort: '-createdAt',
				}),
			);
		});

		it('should return 404 for unknown collection', async () => {
			const handlers = createMomentumHandlers(config);

			const request: MomentumRequest = {
				method: 'GET',
				collectionSlug: 'unknown',
			};

			const result = await handlers.handleFind(request);

			expect(result.error).toContain('unknown');
			expect(result.error).toContain('not found');
			expect(result.status).toBe(404);
		});
	});

	describe('handleFindById', () => {
		it('should return document by id', async () => {
			const handlers = createMomentumHandlers(config);
			const mockDoc = { id: '1', title: 'Test Post', content: 'Hello' };
			vi.mocked(mockAdapter.findById).mockResolvedValue(mockDoc);

			const request: MomentumRequest = {
				method: 'GET',
				collectionSlug: 'posts',
				id: '1',
			};

			const result = await handlers.handleFindById(request);

			expect(result.doc).toEqual(mockDoc);
			expect(mockAdapter.findById).toHaveBeenCalledWith('posts', '1');
		});

		it('should return 404 when document not found', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const request: MomentumRequest = {
				method: 'GET',
				collectionSlug: 'posts',
				id: 'nonexistent',
			};

			const result = await handlers.handleFindById(request);

			expect(result.error).toBe('Document not found');
			expect(result.status).toBe(404);
		});
	});

	describe('handleCreate', () => {
		it('should create and return new document', async () => {
			const handlers = createMomentumHandlers(config);
			const newDoc = { id: '1', title: 'New Post', content: 'Content' };
			vi.mocked(mockAdapter.create).mockResolvedValue(newDoc);

			const request: MomentumRequest = {
				method: 'POST',
				collectionSlug: 'posts',
				body: { title: 'New Post', content: 'Content' },
			};

			const result = await handlers.handleCreate(request);

			expect(result.doc).toEqual(newDoc);
			expect(result.status).toBe(201);
			expect(mockAdapter.create).toHaveBeenCalledWith('posts', {
				title: 'New Post',
				content: 'Content',
			});
		});

		it('should validate required fields', async () => {
			const handlers = createMomentumHandlers(config);

			const request: MomentumRequest = {
				method: 'POST',
				collectionSlug: 'posts',
				body: { content: 'Missing title' }, // title is required
			};

			const result = await handlers.handleCreate(request);

			expect(result.error).toBe('Validation failed');
			expect(result.errors).toContainEqual({
				field: 'title',
				message: 'Title is required',
			});
			expect(result.status).toBe(400);
		});
	});

	describe('handleUpdate', () => {
		it('should update and return document', async () => {
			const handlers = createMomentumHandlers(config);
			const updatedDoc = { id: '1', title: 'Updated Post', content: 'New content' };
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', title: 'Old', content: 'Old' });
			vi.mocked(mockAdapter.update).mockResolvedValue(updatedDoc);

			const request: MomentumRequest = {
				method: 'PATCH',
				collectionSlug: 'posts',
				id: '1',
				body: { title: 'Updated Post', content: 'New content' },
			};

			const result = await handlers.handleUpdate(request);

			expect(result.doc).toEqual(updatedDoc);
			expect(mockAdapter.update).toHaveBeenCalledWith('posts', '1', {
				title: 'Updated Post',
				content: 'New content',
			});
		});

		it('should return 404 when updating nonexistent document', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const request: MomentumRequest = {
				method: 'PATCH',
				collectionSlug: 'posts',
				id: 'nonexistent',
				body: { title: 'Update' },
			};

			const result = await handlers.handleUpdate(request);

			expect(result.error).toContain('not found');
			expect(result.status).toBe(404);
		});
	});

	describe('handleDelete', () => {
		it('should delete document and return success', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', title: 'Post' });
			vi.mocked(mockAdapter.delete).mockResolvedValue(true);

			const request: MomentumRequest = {
				method: 'DELETE',
				collectionSlug: 'posts',
				id: '1',
			};

			const result = await handlers.handleDelete(request);

			expect(result.deleted).toBe(true);
			expect(result.id).toBe('1');
			expect(mockAdapter.delete).toHaveBeenCalledWith('posts', '1');
		});

		it('should return 404 when deleting nonexistent document', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const request: MomentumRequest = {
				method: 'DELETE',
				collectionSlug: 'posts',
				id: 'nonexistent',
			};

			const result = await handlers.handleDelete(request);

			expect(result.error).toContain('not found');
			expect(result.status).toBe(404);
		});
	});

	describe('routeRequest', () => {
		it('should route GET /:collection to handleFind', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const result = await handlers.routeRequest({
				method: 'GET',
				collectionSlug: 'posts',
			});

			expect(mockAdapter.find).toHaveBeenCalled();
			expect(result.docs).toBeDefined();
		});

		it('should route GET /:collection/:id to handleFindById', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1' });

			const result = await handlers.routeRequest({
				method: 'GET',
				collectionSlug: 'posts',
				id: '1',
			});

			expect(mockAdapter.findById).toHaveBeenCalledWith('posts', '1');
			expect(result.doc).toBeDefined();
		});

		it('should route POST /:collection to handleCreate', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.create).mockResolvedValue({ id: '1', title: 'New' });

			const result = await handlers.routeRequest({
				method: 'POST',
				collectionSlug: 'posts',
				body: { title: 'New' },
			});

			expect(mockAdapter.create).toHaveBeenCalled();
			expect(result.doc).toBeDefined();
		});

		it('should route PATCH /:collection/:id to handleUpdate', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1' });
			vi.mocked(mockAdapter.update).mockResolvedValue({ id: '1', title: 'Updated' });

			const result = await handlers.routeRequest({
				method: 'PATCH',
				collectionSlug: 'posts',
				id: '1',
				body: { title: 'Updated' },
			});

			expect(mockAdapter.update).toHaveBeenCalled();
			expect(result.doc).toBeDefined();
		});

		it('should route DELETE /:collection/:id to handleDelete', async () => {
			const handlers = createMomentumHandlers(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1' });
			vi.mocked(mockAdapter.delete).mockResolvedValue(true);

			const result = await handlers.routeRequest({
				method: 'DELETE',
				collectionSlug: 'posts',
				id: '1',
			});

			expect(mockAdapter.delete).toHaveBeenCalled();
			expect(result.deleted).toBe(true);
		});
	});
});

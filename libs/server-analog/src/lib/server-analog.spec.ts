import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMomentumHandler, type H3Event } from './server-analog';
import { createInMemoryAdapter } from '@momentum-cms/server-core';
import type { CollectionConfig, DatabaseAdapter, MomentumConfig } from '@momentum-cms/core';

// Mock collections for testing
const mockPostsCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'content', type: 'textarea', label: 'Content' },
	],
};

describe('createMomentumHandler', () => {
	let adapter: DatabaseAdapter;
	let config: MomentumConfig;
	let handler: ReturnType<typeof createMomentumHandler>;
	let mockUtils: {
		readBody: ReturnType<typeof vi.fn>;
		getQuery: ReturnType<typeof vi.fn>;
		getRouterParams: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		adapter = createInMemoryAdapter();
		config = {
			db: { adapter },
			collections: [mockPostsCollection],
		};
		handler = createMomentumHandler(config);
		mockUtils = {
			readBody: vi.fn().mockResolvedValue({}),
			getQuery: vi.fn().mockReturnValue({}),
			getRouterParams: vi.fn().mockReturnValue({ momentum: '' }),
		};
	});

	function createMockEvent(method: string): H3Event {
		return {
			method,
			path: '/api/posts',
			context: { params: {} },
		};
	}

	describe('GET requests', () => {
		it('should return empty array when no documents exist', async () => {
			mockUtils.getRouterParams.mockReturnValue({ momentum: 'posts' });

			const result = await handler(createMockEvent('GET'), mockUtils);

			expect(result.status).toBe(200);
			expect(result.body.docs).toEqual([]);
		});

		it('should return documents when they exist', async () => {
			mockUtils.getRouterParams.mockReturnValue({ momentum: 'posts' });

			// Create a document first
			mockUtils.readBody.mockResolvedValue({ title: 'Test Post', content: 'Hello' });
			await handler(createMockEvent('POST'), mockUtils);

			// Now get documents
			const result = await handler(createMockEvent('GET'), mockUtils);

			expect(result.status).toBe(200);
			expect(result.body.docs).toHaveLength(1);
		});

		it('should return document by id', async () => {
			mockUtils.getRouterParams.mockReturnValue({ momentum: 'posts' });

			// Create a document first
			mockUtils.readBody.mockResolvedValue({ title: 'Test Post', content: 'Hello' });
			const createResult = await handler(createMockEvent('POST'), mockUtils);
			const id = (createResult.body.doc as Record<string, unknown>)['id'];

			// Get by ID
			mockUtils.getRouterParams.mockReturnValue({ momentum: `posts/${id}` });
			const result = await handler(createMockEvent('GET'), mockUtils);

			expect(result.status).toBe(200);
			expect(result.body.doc).toBeDefined();
		});
	});

	describe('POST requests', () => {
		it('should create document', async () => {
			mockUtils.getRouterParams.mockReturnValue({ momentum: 'posts' });
			mockUtils.readBody.mockResolvedValue({ title: 'New Post', content: 'Content' });

			const result = await handler(createMockEvent('POST'), mockUtils);

			expect(result.status).toBe(201);
			expect((result.body.doc as Record<string, unknown>)['title']).toBe('New Post');
		});

		it('should return 400 for invalid data', async () => {
			mockUtils.getRouterParams.mockReturnValue({ momentum: 'posts' });
			mockUtils.readBody.mockResolvedValue({ content: 'Missing title' });

			const result = await handler(createMockEvent('POST'), mockUtils);

			expect(result.status).toBe(400);
			expect(result.body.error).toBe('Validation failed');
		});
	});

	describe('PATCH requests', () => {
		it('should update document', async () => {
			mockUtils.getRouterParams.mockReturnValue({ momentum: 'posts' });

			// Create a document first
			mockUtils.readBody.mockResolvedValue({ title: 'Original', content: 'Content' });
			const createResult = await handler(createMockEvent('POST'), mockUtils);
			const id = (createResult.body.doc as Record<string, unknown>)['id'];

			// Update
			mockUtils.getRouterParams.mockReturnValue({ momentum: `posts/${id}` });
			mockUtils.readBody.mockResolvedValue({ title: 'Updated' });
			const result = await handler(createMockEvent('PATCH'), mockUtils);

			expect(result.status).toBe(200);
			expect((result.body.doc as Record<string, unknown>)['title']).toBe('Updated');
		});
	});

	describe('DELETE requests', () => {
		it('should delete document', async () => {
			mockUtils.getRouterParams.mockReturnValue({ momentum: 'posts' });

			// Create a document first
			mockUtils.readBody.mockResolvedValue({ title: 'To Delete', content: 'Content' });
			const createResult = await handler(createMockEvent('POST'), mockUtils);
			const id = (createResult.body.doc as Record<string, unknown>)['id'];

			// Delete
			mockUtils.getRouterParams.mockReturnValue({ momentum: `posts/${id}` });
			const result = await handler(createMockEvent('DELETE'), mockUtils);

			expect(result.status).toBe(200);
			expect(result.body.deleted).toBe(true);
		});
	});
});

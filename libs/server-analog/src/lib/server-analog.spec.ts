import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createMomentumHandler,
	createComprehensiveMomentumHandler,
	type H3Event,
	type MomentumH3Utils,
} from './server-analog';
import { createInMemoryAdapter, resetMomentumAPI } from '@momentumcms/server-core';
import type { CollectionConfig, DatabaseAdapter, MomentumConfig } from '@momentumcms/core';

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
		resetMomentumAPI();
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

describe('createComprehensiveMomentumHandler — versioning AccessDeniedError handling', () => {
	const versionedCollection: CollectionConfig = {
		slug: 'articles',
		labels: { singular: 'Article', plural: 'Articles' },
		fields: [{ name: 'title', type: 'text', required: true, label: 'Title' }],
		versions: { drafts: true },
		access: {
			read: () => true,
			create: () => true,
			update: () => true,
			delete: () => true,
			publishVersions: () => false,
			restoreVersions: () => false,
		},
	};

	let comprehensiveHandler: ReturnType<typeof createComprehensiveMomentumHandler>;
	let mockUtils: MomentumH3Utils;
	let statusCapture: number;

	beforeEach(() => {
		resetMomentumAPI();
		const adapter = createInMemoryAdapter();
		const config: MomentumConfig = {
			db: { adapter },
			collections: [versionedCollection],
		};
		comprehensiveHandler = createComprehensiveMomentumHandler(config);
		statusCapture = 200;
		mockUtils = {
			readBody: vi.fn().mockResolvedValue({}),
			getQuery: vi.fn().mockReturnValue({}),
			getRouterParams: vi.fn().mockReturnValue({ momentum: '' }),
			setResponseStatus: vi.fn((_event: H3Event, status: number) => {
				statusCapture = status;
			}),
			setResponseHeader: vi.fn(),
			readMultipartFormData: vi.fn().mockResolvedValue(undefined),
			send: vi.fn(),
		};
	});

	function createMockEvent(method: string): H3Event {
		return {
			method,
			path: '/api/articles',
			context: { params: {} },
		};
	}

	async function createArticle(): Promise<string> {
		(mockUtils.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ title: 'Test Article' });
		(mockUtils.getRouterParams as ReturnType<typeof vi.fn>).mockReturnValue({
			momentum: 'articles',
		});
		statusCapture = 200;
		const result = (await comprehensiveHandler(createMockEvent('POST'), mockUtils, {
			user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
		})) as Record<string, unknown>;
		// The comprehensive handler returns MomentumResponse directly (with doc property)
		const doc = result['doc'] as Record<string, unknown> | undefined;
		if (!doc) {
			throw new Error(
				`createArticle failed: status=${statusCapture}, result=${JSON.stringify(result)}`,
			);
		}
		return doc['id'] as string;
	}

	it('should return 403 when publish throws AccessDeniedError', async () => {
		const articleId = await createArticle();

		(mockUtils.getRouterParams as ReturnType<typeof vi.fn>).mockReturnValue({
			momentum: `articles/${articleId}/publish`,
		});

		// Editor user — publishVersions access returns false
		const result = await comprehensiveHandler(createMockEvent('POST'), mockUtils, {
			user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
		});

		expect(statusCapture).toBe(403);
		expect((result as Record<string, unknown>)['error']).toBe('Access denied');
	});

	it('should return 403 when unpublish throws AccessDeniedError', async () => {
		const articleId = await createArticle();

		// First publish as admin
		(mockUtils.getRouterParams as ReturnType<typeof vi.fn>).mockReturnValue({
			momentum: `articles/${articleId}/publish`,
		});
		await comprehensiveHandler(createMockEvent('POST'), mockUtils, {
			user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
		});

		// Then try to unpublish as editor
		(mockUtils.getRouterParams as ReturnType<typeof vi.fn>).mockReturnValue({
			momentum: `articles/${articleId}/unpublish`,
		});
		const result = await comprehensiveHandler(createMockEvent('POST'), mockUtils, {
			user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
		});

		expect(statusCapture).toBe(403);
		expect((result as Record<string, unknown>)['error']).toBe('Access denied');
	});

	it('should return 403 when version restore throws AccessDeniedError', async () => {
		const articleId = await createArticle();

		(mockUtils.getRouterParams as ReturnType<typeof vi.fn>).mockReturnValue({
			momentum: `articles/${articleId}/versions/restore`,
		});
		(mockUtils.readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
			versionId: 'fake-version-id',
		});

		const result = await comprehensiveHandler(createMockEvent('POST'), mockUtils, {
			user: { id: 'editor-1', email: 'editor@test.com', role: 'editor' },
		});

		expect(statusCapture).toBe(403);
		expect((result as Record<string, unknown>)['error']).toBe('Access denied');
	});
});

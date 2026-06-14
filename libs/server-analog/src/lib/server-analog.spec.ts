import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createMomentumHandler,
	createComprehensiveMomentumHandler,
	type H3Event,
	type MomentumH3Utils,
} from './server-analog';
import { createInMemoryAdapter, resetMomentumAPI } from '@momentumcms/server-core';
import type {
	CollectionConfig,
	DatabaseAdapter,
	MomentumConfig,
	StorageAdapter,
} from '@momentumcms/core';

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

/**
 * These tests defend against a DoS regression: when authentication fails,
 * the adapter must reject the request BEFORE consuming the request body.
 * Reading multipart / JSON bodies for unauthenticated requests lets an
 * attacker force the server to allocate up to the body limit per request
 * just to receive a 401.
 */
describe('createComprehensiveMomentumHandler — auth gates input parsing', () => {
	let comprehensiveHandler: ReturnType<typeof createComprehensiveMomentumHandler>;
	let mockUtils: MomentumH3Utils;
	let statusCapture: number;

	const previewableCollection: CollectionConfig = {
		slug: 'posts',
		fields: [{ name: 'title', type: 'text' }],
		access: { read: () => true },
	};

	beforeEach(() => {
		resetMomentumAPI();
		const adapter = createInMemoryAdapter();
		const config: MomentumConfig = {
			db: { adapter },
			collections: [previewableCollection],
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
			readMultipartFormData: vi.fn().mockResolvedValue([]),
			send: vi.fn(),
		};
	});

	function createMockEvent(method: string): H3Event {
		return { method, path: '/api', context: { params: {} } };
	}

	it('returns 401 for /media/upload without ever reading multipart body', async () => {
		(mockUtils.getRouterParams as ReturnType<typeof vi.fn>).mockReturnValue({
			momentum: 'media/upload',
		});

		const result = await comprehensiveHandler(createMockEvent('POST'), mockUtils);

		expect(statusCapture).toBe(401);
		expect((result as Record<string, unknown>)['error']).toBe(
			'Authentication required to upload files',
		);
		expect(mockUtils.readMultipartFormData).not.toHaveBeenCalled();
	});

	it('returns 401 for POST /:collection/:id/preview without ever reading the JSON body', async () => {
		(mockUtils.getRouterParams as ReturnType<typeof vi.fn>).mockReturnValue({
			momentum: 'posts/abc/preview',
		});

		const result = await comprehensiveHandler(createMockEvent('POST'), mockUtils);

		expect(statusCapture).toBe(401);
		expect((result as Record<string, unknown>)['error']).toBe(
			'Authentication required to access preview',
		);
		expect(mockUtils.readBody).not.toHaveBeenCalled();
	});
});

/**
 * Defends against an unnecessary buffer copy regression: the storage
 * adapter returns a buffer; the handler should pipe that buffer straight
 * through to `utils.send` without wrapping it in a fresh `Buffer.from(...)`,
 * which allocates and copies the entire payload on every media request.
 */
describe('createComprehensiveMomentumHandler — /media/file/* serves without copying', () => {
	let comprehensiveHandler: ReturnType<typeof createComprehensiveMomentumHandler>;
	let mockUtils: MomentumH3Utils;
	let storedBuffer: Uint8Array;

	beforeEach(() => {
		resetMomentumAPI();
		storedBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
		const storageAdapter: StorageAdapter = {
			upload: async () => ({ path: 'photo.jpg', url: '/photo.jpg', size: storedBuffer.length }),
			delete: async () => true,
			getUrl: () => '/photo.jpg',
			exists: async () => true,
			read: async () => storedBuffer,
		};
		const config: MomentumConfig = {
			db: { adapter: createInMemoryAdapter() },
			collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
			storage: { adapter: storageAdapter },
		};
		comprehensiveHandler = createComprehensiveMomentumHandler(config);
		mockUtils = {
			readBody: vi.fn().mockResolvedValue({}),
			getQuery: vi.fn().mockReturnValue({}),
			getRouterParams: vi.fn().mockReturnValue({ momentum: 'media/file/photo.jpg' }),
			setResponseStatus: vi.fn(),
			setResponseHeader: vi.fn(),
			readMultipartFormData: vi.fn().mockResolvedValue([]),
			send: vi.fn(),
		};
	});

	function createMockEvent(method: string): H3Event {
		return { method, path: '/api/media/file/photo.jpg', context: { params: {} } };
	}

	it('passes the storage buffer to utils.send by reference (no Buffer.from copy)', async () => {
		await comprehensiveHandler(createMockEvent('GET'), mockUtils);

		const sendMock = mockUtils.send as ReturnType<typeof vi.fn>;
		expect(sendMock).toHaveBeenCalledTimes(1);
		const sentArg = sendMock.mock.calls[0]?.[1];
		// Same reference — no copy. `Buffer.from(uint8Array)` would produce a new Buffer.
		expect(sentArg).toBe(storedBuffer);
	});
});

// Adapter-level coverage for the workflow `transition` + `workflow-history`
// routes added to server-analog. The shared e2e spec only exercises these
// under E2E_SERVER_FLAVOR=analog (not the default flavor), so these tests pin
// the analog dispatcher wiring (segment routing, body/query parsing, the
// unknown-action 404 fallthrough) directly against the in-memory adapter.
describe('createComprehensiveMomentumHandler — workflow routes', () => {
	const workflowCollection: CollectionConfig = {
		slug: 'articles',
		labels: { singular: 'Article', plural: 'Articles' },
		fields: [{ name: 'title', type: 'text', required: true, label: 'Title' }],
		versions: { drafts: true },
		access: { read: () => true, create: () => true, update: () => true, delete: () => true },
		workflow: {
			stages: [
				{ id: 'draft', label: 'Draft', transitions: ['in-review'] },
				{ id: 'in-review', label: 'In Review', transitions: ['draft', 'approved'] },
				{ id: 'approved', label: 'Approved', transitions: ['draft'], publishesOnEnter: true },
			],
			initialStage: 'draft',
		},
	};

	let comprehensiveHandler: ReturnType<typeof createComprehensiveMomentumHandler>;
	let mockUtils: MomentumH3Utils;
	let statusCapture: number;
	const adminCtx = { user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' } };

	beforeEach(() => {
		resetMomentumAPI();
		const adapter = createInMemoryAdapter();
		const config: MomentumConfig = { db: { adapter }, collections: [workflowCollection] };
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

	function event(method: string): H3Event {
		return { method, path: '/api/articles', context: { params: {} } };
	}
	function route(momentum: string): void {
		(mockUtils.getRouterParams as ReturnType<typeof vi.fn>).mockReturnValue({ momentum });
	}
	function body(value: Record<string, unknown>): void {
		(mockUtils.readBody as ReturnType<typeof vi.fn>).mockResolvedValue(value);
	}
	async function createArticle(): Promise<string> {
		route('articles');
		body({ title: 'WF Article' });
		statusCapture = 200;
		const result = (await comprehensiveHandler(event('POST'), mockUtils, adminCtx)) as Record<
			string,
			unknown
		>;
		const doc = result['doc'] as Record<string, unknown> | undefined;
		if (!doc) throw new Error(`createArticle failed: status=${statusCapture}`);
		return doc['id'] as string;
	}

	it('POST /:id/transition moves the document to a new stage', async () => {
		const id = await createArticle();
		route(`articles/${id}/transition`);
		body({ toStage: 'in-review' });
		const result = (await comprehensiveHandler(event('POST'), mockUtils, adminCtx)) as Record<
			string,
			unknown
		>;
		expect(statusCapture).toBe(200);
		expect(result).toMatchObject({ fromStage: 'draft', toStage: 'in-review' });
	});

	it('POST /:id/transition returns 400 when toStage is missing (body is parsed)', async () => {
		const id = await createArticle();
		route(`articles/${id}/transition`);
		body({});
		await comprehensiveHandler(event('POST'), mockUtils, adminCtx);
		expect(statusCapture).toBe(400);
	});

	it('POST /:id/<unknown-action> falls through to 404 (transition branch does not shadow it)', async () => {
		const id = await createArticle();
		route(`articles/${id}/bogus-action`);
		const result = (await comprehensiveHandler(event('POST'), mockUtils, adminCtx)) as Record<
			string,
			unknown
		>;
		expect(statusCapture).toBe(404);
		expect(String(result['message'])).toContain('bogus-action');
	});

	it('GET /:id/workflow-history returns the audit trail incl. the creation anchor', async () => {
		const id = await createArticle();
		route(`articles/${id}/workflow-history`);
		const result = (await comprehensiveHandler(event('GET'), mockUtils, adminCtx)) as Record<
			string,
			unknown
		>;
		expect(statusCapture).toBe(200);
		expect(result['totalDocs']).toBe(1);
		const docs = result['docs'] as Array<Record<string, unknown>>;
		expect(docs[0]).toMatchObject({ fromStage: null, toStage: 'draft' });
	});

	it('GET /:id/workflow-history coerces a non-numeric ?limit to the default instead of breaking pagination', async () => {
		const id = await createArticle();
		route(`articles/${id}/workflow-history`);
		// h3 getQuery returns string values; `abc` must not reach the adapter as NaN.
		(mockUtils.getQuery as ReturnType<typeof vi.fn>).mockReturnValue({ limit: 'abc', page: 'xyz' });
		const result = (await comprehensiveHandler(event('GET'), mockUtils, adminCtx)) as Record<
			string,
			unknown
		>;
		expect(statusCapture).toBe(200);
		// With the NaN guard, the default page size applies and the anchor row is
		// returned; without it, limit=NaN yields an empty/inconsistent page.
		const docs = result['docs'] as Array<Record<string, unknown>>;
		expect(docs).toHaveLength(Number(result['totalDocs']));
		expect(docs.length).toBeGreaterThanOrEqual(1);
	});

	it('GET /:id/workflow-history honors a numeric ?limit/?page', async () => {
		const id = await createArticle();
		route(`articles/${id}/workflow-history`);
		(mockUtils.getQuery as ReturnType<typeof vi.fn>).mockReturnValue({ limit: '1', page: '1' });
		const result = (await comprehensiveHandler(event('GET'), mockUtils, adminCtx)) as Record<
			string,
			unknown
		>;
		expect(statusCapture).toBe(200);
		expect(result['limit']).toBe(1);
		expect(result['page']).toBe(1);
	});

	it('transition on a non-workflow collection returns 400 WorkflowNotConfigured (not swallowed)', async () => {
		// Re-init with a non-workflow collection.
		resetMomentumAPI();
		const adapter = createInMemoryAdapter();
		comprehensiveHandler = createComprehensiveMomentumHandler({
			db: { adapter },
			collections: [
				{
					slug: 'tags',
					fields: [{ name: 'name', type: 'text', required: true }],
					access: { read: () => true, create: () => true, update: () => true, delete: () => true },
				},
			],
		});
		route('tags');
		body({ name: 'urgent' });
		const created = (await comprehensiveHandler(event('POST'), mockUtils, adminCtx)) as Record<
			string,
			unknown
		>;
		const tagId = (created['doc'] as Record<string, unknown>)['id'];
		route(`tags/${tagId}/transition`);
		body({ toStage: 'in-review' });
		await comprehensiveHandler(event('POST'), mockUtils, adminCtx);
		expect(statusCapture).toBe(400);
	});
});

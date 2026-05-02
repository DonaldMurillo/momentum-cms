import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { momentumApiMiddleware } from './server-express';
import { createInMemoryAdapter, resetMomentumAPI } from '@momentumcms/server-core';
import type {
	CollectionConfig,
	MomentumConfig,
	DatabaseAdapter,
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

const mockUsersCollection: CollectionConfig = {
	slug: 'users',
	labels: { singular: 'User', plural: 'Users' },
	fields: [
		{ name: 'name', type: 'text', required: true, label: 'Name' },
		{ name: 'email', type: 'email', required: true, label: 'Email' },
	],
};

const mockMediaCollection: CollectionConfig = {
	slug: 'media',
	labels: { singular: 'Media', plural: 'Media' },
	fields: [
		{ name: 'filename', type: 'text', required: true, label: 'Filename' },
		{ name: 'mimeType', type: 'text', required: true, label: 'MIME Type' },
		{ name: 'alt', type: 'text', label: 'Alt Text' },
	],
	upload: {
		mimeTypes: ['image/*'],
	},
};

describe('momentumApiMiddleware', () => {
	let adapter: DatabaseAdapter;
	let app: express.Application;
	let config: MomentumConfig;

	beforeEach(() => {
		resetMomentumAPI();
		adapter = createInMemoryAdapter();
		config = {
			collections: [mockPostsCollection, mockUsersCollection],
			db: { adapter },
			server: { port: 4000 },
		};
		app = express();
		app.use('/api', momentumApiMiddleware(config));
	});

	describe('GET /:collection', () => {
		it('should return empty array when no documents exist', async () => {
			const res = await request(app).get('/api/posts');

			expect(res.status).toBe(200);
			expect(res.body.docs).toEqual([]);
			expect(res.body.totalDocs).toBe(0);
		});

		it('should return documents when they exist', async () => {
			// Create a document first
			await request(app).post('/api/posts').send({ title: 'Test Post', content: 'Hello' });

			const res = await request(app).get('/api/posts');

			expect(res.status).toBe(200);
			expect(res.body.docs).toHaveLength(1);
			expect(res.body.docs[0].title).toBe('Test Post');
		});

		it('should return 404 for unknown collection', async () => {
			const res = await request(app).get('/api/unknown');

			expect(res.status).toBe(404);
			expect(res.body.error).toBe('Collection "unknown" not found');
		});
	});

	describe('GET /:collection/:id', () => {
		it('should return document by id', async () => {
			// Create a document first
			const createRes = await request(app)
				.post('/api/posts')
				.send({ title: 'Test Post', content: 'Hello' });

			const id = createRes.body.doc.id;
			const res = await request(app).get(`/api/posts/${id}`);

			expect(res.status).toBe(200);
			expect(res.body.doc.title).toBe('Test Post');
		});

		it('should return 404 for nonexistent document', async () => {
			const res = await request(app).get('/api/posts/nonexistent');

			expect(res.status).toBe(404);
			expect(res.body.error).toContain('not found');
		});
	});

	describe('POST /:collection', () => {
		it('should create and return new document', async () => {
			const res = await request(app)
				.post('/api/posts')
				.send({ title: 'New Post', content: 'Content' });

			expect(res.status).toBe(201);
			expect(res.body.doc.title).toBe('New Post');
			expect(res.body.doc.id).toBeDefined();
		});

		it('should return 400 when required fields are missing', async () => {
			const res = await request(app).post('/api/posts').send({ content: 'Missing title' });

			expect(res.status).toBe(400);
			expect(res.body.error).toBe('Validation failed');
			expect(res.body.errors).toContainEqual({
				field: 'title',
				message: 'Title is required',
			});
		});
	});

	describe('PATCH /:collection/:id', () => {
		it('should update and return document', async () => {
			// Create a document first
			const createRes = await request(app)
				.post('/api/posts')
				.send({ title: 'Original', content: 'Content' });

			const id = createRes.body.doc.id;
			const res = await request(app).patch(`/api/posts/${id}`).send({ title: 'Updated' });

			expect(res.status).toBe(200);
			expect(res.body.doc.title).toBe('Updated');
		});

		it('should return 404 for nonexistent document', async () => {
			const res = await request(app).patch('/api/posts/nonexistent').send({ title: 'Update' });

			expect(res.status).toBe(404);
		});

		it('should handle JSON updates for upload collections without invoking multipart parsing', async () => {
			const uploadAdapter = createInMemoryAdapter();
			const uploadConfig: MomentumConfig = {
				collections: [mockMediaCollection],
				db: { adapter: uploadAdapter },
				server: { port: 4000 },
			};
			resetMomentumAPI();
			const uploadApp = express();
			uploadApp.use((req, _res, next) => {
				Object.assign(req, {
					user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
				});
				next();
			});
			uploadApp.use('/api', momentumApiMiddleware(uploadConfig));

			const created = await uploadAdapter.create('media', {
				filename: 'existing.jpg',
				mimeType: 'image/jpeg',
			});

			const res = await request(uploadApp).patch(`/api/media/${created['id']}`).send({
				alt: 'Updated alt text',
			});

			expect(res.status).toBe(200);
			expect(res.body.doc.alt).toBe('Updated alt text');
		});
	});

	describe('DELETE /:collection/:id', () => {
		it('should delete document and return success', async () => {
			// Create a document first
			const createRes = await request(app)
				.post('/api/posts')
				.send({ title: 'To Delete', content: 'Content' });

			const id = createRes.body.doc.id;
			const res = await request(app).delete(`/api/posts/${id}`);

			expect(res.status).toBe(200);
			expect(res.body.deleted).toBe(true);

			// Verify document is deleted
			const getRes = await request(app).get(`/api/posts/${id}`);
			expect(getRes.status).toBe(404);
		});

		it('should return 404 for nonexistent document', async () => {
			const res = await request(app).delete('/api/posts/nonexistent');

			expect(res.status).toBe(404);
		});
	});

	describe('CORS headers', () => {
		it('should include CORS headers', async () => {
			const res = await request(app).get('/api/posts');

			expect(res.headers['access-control-allow-origin']).toBe('*');
		});

		it('should reject non-matching origins when explicit origins are configured', async () => {
			const corsAdapter = createInMemoryAdapter();
			const corsConfig: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: corsAdapter },
				server: {
					port: 4000,
					cors: { origin: ['https://allowed.com'] },
				},
			};
			const corsApp = express();
			corsApp.use('/api', momentumApiMiddleware(corsConfig));

			const res = await request(corsApp).get('/api/posts').set('Origin', 'https://evil.com');

			// Non-matching origin should NOT get an Access-Control-Allow-Origin header
			expect(res.headers['access-control-allow-origin']).toBeUndefined();
		});

		it('should allow matching origins', async () => {
			const corsAdapter = createInMemoryAdapter();
			const corsConfig: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: corsAdapter },
				server: {
					port: 4000,
					cors: { origin: ['https://allowed.com'] },
				},
			};
			const corsApp = express();
			corsApp.use('/api', momentumApiMiddleware(corsConfig));

			const res = await request(corsApp).get('/api/posts').set('Origin', 'https://allowed.com');

			expect(res.headers['access-control-allow-origin']).toBe('https://allowed.com');
		});
	});

	describe('security headers', () => {
		it('should include X-Content-Type-Options: nosniff', async () => {
			const res = await request(app).get('/api/posts');
			expect(res.headers['x-content-type-options']).toBe('nosniff');
		});

		it('should include X-Frame-Options: SAMEORIGIN', async () => {
			const res = await request(app).get('/api/posts');
			expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
		});

		it('should include Referrer-Policy', async () => {
			const res = await request(app).get('/api/posts');
			expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
		});

		it('should include X-Permitted-Cross-Domain-Policies: none', async () => {
			const res = await request(app).get('/api/posts');
			expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');
		});
	});

	/**
	 * Defends against an unnecessary buffer copy regression in
	 * `GET /api/media/file/*`: the storage adapter returns a buffer; the
	 * adapter should pass that buffer straight to `res.send` without
	 * wrapping it in `Buffer.from(...)`, which allocates and copies the
	 * entire payload on every media request.
	 */
	describe('GET /media/file/* serves without copying', () => {
		it('passes the storage buffer to res.send by reference (no Buffer.from copy)', async () => {
			const storedBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
			const storageAdapter: StorageAdapter = {
				upload: async () => ({
					path: 'photo.jpg',
					url: '/photo.jpg',
					size: storedBuffer.length,
				}),
				delete: async () => true,
				getUrl: () => '/photo.jpg',
				exists: async () => true,
				read: async () => storedBuffer,
			};
			const mediaConfig: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: createInMemoryAdapter() },
				server: { port: 4000 },
				storage: { adapter: storageAdapter },
			};
			resetMomentumAPI();
			const mediaApp = express();
			let capturedSendArg: unknown = null;
			mediaApp.use((_req, res, next) => {
				const originalSend = res.send.bind(res);
				res.send = (body: unknown) => {
					capturedSendArg = body;
					return originalSend(body);
				};
				next();
			});
			mediaApp.use('/api', momentumApiMiddleware(mediaConfig));

			const res = await request(mediaApp).get('/api/media/file/photo.jpg');

			expect(res.status).toBe(200);
			// Same reference — no copy. `Buffer.from(buffer)` would produce a new Buffer.
			expect(capturedSendArg).toBe(storedBuffer);
		});
	});

	describe('custom endpoint query.findById', () => {
		it('should return null for nonexistent doc instead of throwing', async () => {
			// Add a custom endpoint to posts that uses query.findById
			const postsWithEndpoint: CollectionConfig = {
				...mockPostsCollection,
				endpoints: [
					{
						path: 'lookup',
						method: 'get',
						handler: async ({ query: q }) => {
							const doc = await q.findById('posts', 'nonexistent-id');
							return {
								status: 200,
								body: { found: doc !== null, doc },
							};
						},
					},
				],
			};

			const endpointAdapter = createInMemoryAdapter();
			const endpointConfig: MomentumConfig = {
				collections: [postsWithEndpoint],
				db: { adapter: endpointAdapter },
				server: { port: 4000 },
			};
			const endpointApp = express();
			endpointApp.use('/api', momentumApiMiddleware(endpointConfig));

			const res = await request(endpointApp).get('/api/posts/lookup');

			// Should NOT be 500 (unhandled throw) — should return the handler's response
			expect(res.status).toBe(200);
			expect(res.body.found).toBe(false);
			expect(res.body.doc).toBeNull();
		});
	});
});

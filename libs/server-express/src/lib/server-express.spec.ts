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

	/**
	 * Red-team finding (cms-feature-red-team #10): cookie-auth + state-changing
	 * POST + no Origin check = CSRF. Better-Auth's CSRF protection covers
	 * `/api/auth/*` but the CMS routes mounted under `/api/:collection/*` were
	 * unguarded — a malicious site could trigger publish, transition, or any
	 * mutation against a logged-in admin via a forged form-post.
	 *
	 * The guard activates ONLY when `config.server.cors.origin` is an explicit
	 * list. When `origin === '*'` or unset, the developer has opted out of CSRF
	 * protection (and CORS) entirely. CLI / server-to-server callers with no
	 * Origin and no Referer pass through — only browser-initiated forged
	 * requests are blocked.
	 */
	describe('CSRF / Origin guard on state-changing methods', () => {
		function makeApp(): { app: express.Application; csrfConfig: MomentumConfig } {
			const csrfAdapter = createInMemoryAdapter();
			const csrfConfig: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: csrfAdapter },
				server: {
					port: 4000,
					cors: { origin: ['https://allowed.example'] },
				},
			};
			const csrfApp = express();
			csrfApp.use('/api', momentumApiMiddleware(csrfConfig));
			return { app: csrfApp, csrfConfig };
		}

		it('rejects POST with an Origin header that is not in the trusted list', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.post('/api/posts')
				.set('Origin', 'https://evil.example')
				.send({ title: 'forged', content: 'csrf' });
			expect(res.status).toBe(403);
			expect(res.body.code).toBe('CSRF_ORIGIN_MISMATCH');
		});

		it('rejects PATCH with mismatched Origin', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.patch('/api/posts/some-id')
				.set('Origin', 'https://evil.example')
				.send({ title: 'tampered' });
			expect(res.status).toBe(403);
			expect(res.body.code).toBe('CSRF_ORIGIN_MISMATCH');
		});

		it('rejects DELETE with mismatched Origin', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.delete('/api/posts/some-id')
				.set('Origin', 'https://evil.example');
			expect(res.status).toBe(403);
			expect(res.body.code).toBe('CSRF_ORIGIN_MISMATCH');
		});

		it('rejects PUT with mismatched Origin', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.put('/api/posts/some-id')
				.set('Origin', 'https://evil.example')
				.send({ title: 'forged' });
			expect(res.status).toBe(403);
			expect(res.body.code).toBe('CSRF_ORIGIN_MISMATCH');
		});

		it('allows POST with an Origin header in the trusted list', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.post('/api/posts')
				.set('Origin', 'https://allowed.example')
				.send({ title: 'legitimate', content: 'ok' });
			expect(res.status).toBe(201);
		});

		it('falls back to Referer when Origin is absent and rejects mismatched Referer', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.post('/api/posts')
				.set('Referer', 'https://evil.example/some/page')
				.send({ title: 'forged', content: 'via-referer' });
			expect(res.status).toBe(403);
			expect(res.body.code).toBe('CSRF_ORIGIN_MISMATCH');
		});

		it('allows POST when neither Origin nor Referer is present (CLI / server-to-server)', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.post('/api/posts')
				.send({ title: 'cli-script', content: 'no headers' });
			expect(res.status).toBe(201);
		});

		it('allows GET with mismatched Origin (read-only methods are not state-changing)', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp).get('/api/posts').set('Origin', 'https://evil.example');
			expect(res.status).toBe(200);
		});

		it('allows OPTIONS preflight from any origin (browser preflight, not a state change)', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.options('/api/posts')
				.set('Origin', 'https://evil.example');
			expect(res.status).toBe(204);
		});

		it('does NOT enforce when cors.origin is "*" (developer opted out)', async () => {
			const openAdapter = createInMemoryAdapter();
			const openConfig: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: openAdapter },
				server: { port: 4000, cors: { origin: '*' } },
			};
			const openApp = express();
			openApp.use('/api', momentumApiMiddleware(openConfig));
			const res = await request(openApp)
				.post('/api/posts')
				.set('Origin', 'https://evil.example')
				.send({ title: 'wide-open', content: 'no csrf gate' });
			expect(res.status).toBe(201);
		});

		it('does NOT enforce when cors.origin is unset (no trusted-origin list to compare against)', async () => {
			const looseAdapter = createInMemoryAdapter();
			const looseConfig: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: looseAdapter },
				server: { port: 4000 },
			};
			const looseApp = express();
			looseApp.use('/api', momentumApiMiddleware(looseConfig));
			const res = await request(looseApp)
				.post('/api/posts')
				.set('Origin', 'https://evil.example')
				.send({ title: 'no-cors-config', content: 'ok' });
			expect(res.status).toBe(201);
		});

		it('rejects an Origin that is a substring suffix of a trusted origin (no suffix-match weakness)', async () => {
			// 'https://allowed.example' must not loosely-match 'https://evilallowed.example'.
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.post('/api/posts')
				.set('Origin', 'https://evilallowed.example')
				.send({ title: 'suffix-trick', content: 'nope' });
			expect(res.status).toBe(403);
		});

		it('rejects a malformed Origin header that cannot be parsed', async () => {
			const { app: csrfApp } = makeApp();
			const res = await request(csrfApp)
				.post('/api/posts')
				.set('Origin', 'not a url')
				.send({ title: 'malformed-origin', content: 'nope' });
			expect(res.status).toBe(403);
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

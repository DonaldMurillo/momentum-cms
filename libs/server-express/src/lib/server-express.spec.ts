import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { momentumApiMiddleware } from './server-express';
import { createInMemoryAdapter } from '@momentumcms/server-core';
import type { CollectionConfig, MomentumConfig, DatabaseAdapter } from '@momentumcms/core';

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

describe('momentumApiMiddleware', () => {
	let adapter: DatabaseAdapter;
	let app: express.Application;
	let config: MomentumConfig;

	beforeEach(() => {
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

		it('should include X-Frame-Options: DENY', async () => {
			const res = await request(app).get('/api/posts');
			expect(res.headers['x-frame-options']).toBe('DENY');
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMetaRouter } from '../meta-handler';
import type { MetaHandlerOptions } from '../meta-handler';
import type { MomentumAPI } from '@momentumcms/plugins/core';

function mockApi(
	doc: Record<string, unknown> | null = { id: '1', title: 'Test', seo: {} },
): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			findById: vi.fn().mockResolvedValue(doc),
		}),
		getConfig: vi.fn(),
	} as unknown as MomentumAPI;
}

function createApp(options: Partial<MetaHandlerOptions> = {}, adminUser = true): express.Express {
	const app = express();

	// Simulate auth middleware
	app.use((req, _res, next) => {
		if (adminUser) {
			Object.assign(req, { user: { id: '1', role: 'admin', email: 'admin@test.com' } });
		}
		next();
	});

	app.use(
		createMetaRouter({
			getApi: options.getApi ?? (() => mockApi()),
			siteUrl: options.siteUrl ?? 'https://example.com',
			seoCollections: options.seoCollections ?? ['posts'],
		}),
	);
	return app;
}

describe('Meta Handler', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('GET /meta/:collection/:id should return 200 with JSON', async () => {
		const app = createApp();
		const res = await request(app).get('/meta/posts/1');
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toContain('application/json');
	});

	it('should return meta tags with title from seo data', async () => {
		const api = mockApi({
			id: '1',
			title: 'Doc Title',
			seo: { metaTitle: 'Custom Title', metaDescription: 'Custom desc' },
		});
		const app = createApp({ getApi: () => api });
		const res = await request(app).get('/meta/posts/1');

		expect(res.status).toBe(200);
		expect(res.body.title).toBe('Custom Title');
		expect(res.body.meta).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'description', content: 'Custom desc' }),
			]),
		);
	});

	it('should return OG meta tags', async () => {
		const api = mockApi({
			id: '1',
			seo: {
				metaTitle: 'Title',
				ogTitle: 'OG Title',
				ogDescription: 'OG Desc',
				ogImage: 'https://example.com/img.jpg',
			},
		});
		const app = createApp({ getApi: () => api });
		const res = await request(app).get('/meta/posts/1');

		expect(res.body.meta).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ property: 'og:title', content: 'OG Title' }),
				expect.objectContaining({ property: 'og:description', content: 'OG Desc' }),
				expect.objectContaining({ property: 'og:image', content: 'https://example.com/img.jpg' }),
			]),
		);
	});

	it('should return 404 when document not found', async () => {
		const api = mockApi(null);
		const app = createApp({ getApi: () => api });
		const res = await request(app).get('/meta/posts/nonexistent');
		expect(res.status).toBe(404);
	});

	it('should return 503 when API not ready', async () => {
		const app = createApp({ getApi: () => null });
		const res = await request(app).get('/meta/posts/1');
		expect(res.status).toBe(503);
	});

	it('should populate ogImage relationship (depth=1)', async () => {
		const api = mockApi({
			id: '1',
			seo: {
				metaTitle: 'Title',
				ogImage: { url: 'https://cdn.example.com/image.jpg', alt: 'Alt text' },
			},
		});
		const app = createApp({ getApi: () => api });
		const res = await request(app).get('/meta/posts/1');

		expect(res.body.meta).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					property: 'og:image',
					content: 'https://cdn.example.com/image.jpg',
				}),
			]),
		);
	});

	it('should fallback title to doc title field', async () => {
		const api = mockApi({ id: '1', title: 'Fallback Title', seo: {} });
		const app = createApp({ getApi: () => api });
		const res = await request(app).get('/meta/posts/1');
		expect(res.body.title).toBe('Fallback Title');
	});

	it('should return 500 when findById throws', async () => {
		const api = {
			collection: vi.fn().mockReturnValue({
				findById: vi.fn().mockRejectedValue(new Error('DB error')),
			}),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;
		const app = createApp({ getApi: () => api });
		const res = await request(app).get('/meta/posts/1');
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to build meta tags');
	});

	it('should handle doc with no seo data', async () => {
		const api = mockApi({ id: '1', title: 'No SEO' });
		const app = createApp({ getApi: () => api });
		const res = await request(app).get('/meta/posts/1');
		expect(res.status).toBe(200);
		expect(res.body.title).toBe('No SEO');
	});

	it('should reject collections not in the seoCollections allowlist', async () => {
		const api = mockApi({ id: '1', title: 'Secret', seo: {} });
		const app = createApp({
			getApi: () => api,
			seoCollections: ['posts', 'pages'],
		});
		const res = await request(app).get('/meta/users/1');
		expect(res.status).toBe(404);
		expect(res.body.error).toBe('Collection not SEO-enabled');
		// Must not call the API for disallowed collections
		expect(api.collection).not.toHaveBeenCalled();
	});

	it('should allow collections in the seoCollections allowlist', async () => {
		const api = mockApi({ id: '1', title: 'Public', seo: {} });
		const app = createApp({
			getApi: () => api,
			seoCollections: ['posts', 'pages'],
		});
		const res = await request(app).get('/meta/pages/1');
		expect(res.status).toBe(200);
	});

	it('should return 401 when no user is authenticated', async () => {
		const app = createApp({}, false);
		const res = await request(app).get('/meta/posts/1');
		expect(res.status).toBe(401);
	});

	it('should return 401 for non-admin users', async () => {
		const app = express();
		app.use((req, _res, next) => {
			Object.assign(req, { user: { id: '2', role: 'viewer', email: 'viewer@test.com' } });
			next();
		});
		app.use(
			createMetaRouter({
				getApi: () => mockApi(),
				siteUrl: 'https://example.com',
				seoCollections: ['posts'],
			}),
		);

		const res = await request(app).get('/meta/posts/1');
		expect(res.status).toBe(401);
	});
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createSitemapSettingsRouter } from '../sitemap-settings-handler';
import type { SitemapSettingsHandlerOptions } from '../sitemap-settings-handler';
import type { MomentumAPI } from '@momentumcms/plugins/core';

function mockApi(docs: Array<Record<string, unknown>> = []): {
	api: MomentumAPI;
	find: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
} {
	const find = vi.fn().mockResolvedValue({ docs });
	const create = vi
		.fn()
		.mockImplementation((data: Record<string, unknown>) =>
			Promise.resolve({ id: 'new-id', ...data }),
		);
	const update = vi
		.fn()
		.mockImplementation((id: string, data: Record<string, unknown>) =>
			Promise.resolve({ id, ...data }),
		);

	const api = {
		collection: vi.fn().mockReturnValue({ find, create, update }),
		getConfig: vi.fn(),
	} as unknown as MomentumAPI;

	return { api, find, create, update };
}

function createApp(
	overrides: Partial<SitemapSettingsHandlerOptions> = {},
	adminUser = true,
): express.Express {
	const { api } = mockApi();
	const app = express();
	app.use(express.json());

	// Simulate auth middleware
	app.use((req, _res, next) => {
		if (adminUser) {
			Object.assign(req, { user: { id: '1', role: 'admin', email: 'admin@test.com' } });
		}
		next();
	});

	const router = createSitemapSettingsRouter({
		getApi: overrides.getApi ?? (() => api),
		seoCollections: overrides.seoCollections ?? ['articles', 'pages', 'categories'],
		onSettingsChanged: overrides.onSettingsChanged,
	});
	app.use(router);
	return app;
}

describe('Sitemap Settings Handler', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe('GET /sitemap-settings', () => {
		it('should return 401 for non-admin users', async () => {
			const app = createApp({}, false);
			const res = await request(app).get('/sitemap-settings');
			expect(res.status).toBe(401);
		});

		it('should return 503 when API not ready', async () => {
			const app = createApp({ getApi: () => null });
			const res = await request(app).get('/sitemap-settings');
			expect(res.status).toBe(503);
		});

		it('should return merged list with defaults for collections without saved settings', async () => {
			const { api } = mockApi([]); // no saved settings
			const app = createApp({ getApi: () => api });
			const res = await request(app).get('/sitemap-settings');

			expect(res.status).toBe(200);
			expect(res.body.settings).toHaveLength(3);
			expect(res.body.settings[0]).toEqual({
				collection: 'articles',
				includeInSitemap: true,
				priority: null,
				changeFreq: null,
				id: null,
			});
		});

		it('should return saved settings when present', async () => {
			const { api } = mockApi([
				{
					id: 'set-1',
					collection: 'articles',
					includeInSitemap: false,
					priority: 0.8,
					changeFreq: 'daily',
				},
			]);
			const app = createApp({ getApi: () => api });
			const res = await request(app).get('/sitemap-settings');

			expect(res.status).toBe(200);
			const articlesSetting = res.body.settings.find(
				(s: Record<string, unknown>) => s.collection === 'articles',
			);
			expect(articlesSetting).toEqual({
				collection: 'articles',
				includeInSitemap: false,
				priority: 0.8,
				changeFreq: 'daily',
				id: 'set-1',
			});

			// pages should still have defaults
			const pagesSetting = res.body.settings.find(
				(s: Record<string, unknown>) => s.collection === 'pages',
			);
			expect(pagesSetting?.includeInSitemap).toBe(true);
			expect(pagesSetting?.priority).toBeNull();
		});
	});

	describe('PUT /sitemap-settings/:collection', () => {
		it('should return 401 for non-admin users', async () => {
			const app = createApp({}, false);
			const res = await request(app)
				.put('/sitemap-settings/articles')
				.send({ includeInSitemap: false });
			expect(res.status).toBe(401);
		});

		it('should return 400 for invalid collection slug', async () => {
			const app = createApp();
			const res = await request(app)
				.put('/sitemap-settings/nonexistent')
				.send({ includeInSitemap: false });
			expect(res.status).toBe(400);
		});

		it('should return 503 when API not ready', async () => {
			const app = createApp({ getApi: () => null });
			const res = await request(app)
				.put('/sitemap-settings/articles')
				.send({ includeInSitemap: false });
			expect(res.status).toBe(503);
		});

		it('should create new settings when none exist', async () => {
			const { api, find, create } = mockApi([]);
			find.mockResolvedValue({ docs: [] }); // no existing row
			const app = createApp({ getApi: () => api });

			const res = await request(app)
				.put('/sitemap-settings/articles')
				.send({ includeInSitemap: false, priority: 0.7, changeFreq: 'daily' });

			expect(res.status).toBe(200);
			expect(create).toHaveBeenCalledWith(
				expect.objectContaining({
					collection: 'articles',
					includeInSitemap: false,
					priority: 0.7,
					changeFreq: 'daily',
				}),
			);
		});

		it('should update existing settings', async () => {
			const { api, find, update } = mockApi();
			find.mockResolvedValue({ docs: [{ id: 'set-1', collection: 'articles' }] });
			const app = createApp({ getApi: () => api });

			const res = await request(app)
				.put('/sitemap-settings/articles')
				.send({ includeInSitemap: true, priority: 0.9 });

			expect(res.status).toBe(200);
			expect(update).toHaveBeenCalledWith(
				'set-1',
				expect.objectContaining({
					collection: 'articles',
					includeInSitemap: true,
					priority: 0.9,
				}),
			);
		});

		it('should clamp priority to 0-1 range', async () => {
			const { api, find, create } = mockApi([]);
			find.mockResolvedValue({ docs: [] });
			const app = createApp({ getApi: () => api });

			await request(app).put('/sitemap-settings/articles').send({ priority: 5.0 });

			expect(create).toHaveBeenCalledWith(expect.objectContaining({ priority: 1 }));
		});

		it('should call onSettingsChanged callback after successful save', async () => {
			const onSettingsChanged = vi.fn();
			const { api, find } = mockApi([]);
			find.mockResolvedValue({ docs: [] });
			const app = createApp({ getApi: () => api, onSettingsChanged });

			await request(app).put('/sitemap-settings/articles').send({ includeInSitemap: false });

			expect(onSettingsChanged).toHaveBeenCalledOnce();
		});

		it('should reject invalid changeFreq values', async () => {
			const app = createApp();
			const res = await request(app)
				.put('/sitemap-settings/articles')
				.send({ changeFreq: '<injected>xml</injected>' });
			expect(res.status).toBe(400);
		});

		it('should accept valid changeFreq values', async () => {
			const { api, find } = mockApi([]);
			find.mockResolvedValue({ docs: [] });
			const app = createApp({ getApi: () => api });

			for (const freq of ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']) {
				const res = await request(app).put('/sitemap-settings/articles').send({ changeFreq: freq });
				expect(res.status).toBe(200);
			}
		});
	});
});

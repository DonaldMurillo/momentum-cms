import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createContentPerformanceRouter } from '../content-performance/content-performance-handler';
import { MemoryAnalyticsAdapter } from '../adapters/memory-adapter';
import type { AnalyticsEvent } from '../analytics-event.types';

function makeEvent(overrides: Partial<AnalyticsEvent>): AnalyticsEvent {
	return {
		id: `evt-${Math.random().toString(36).slice(2, 8)}`,
		category: 'page',
		name: 'page_view',
		timestamp: new Date().toISOString(),
		properties: {},
		context: { source: 'client' },
		...overrides,
	};
}

function createApp(adapter: MemoryAnalyticsAdapter): express.Express {
	const app = express();
	// Simulate auth middleware setting req.user (requireAuth checks for this)
	app.use((_req, _res, next) => {
		Object.assign(_req, { user: { id: 'test-user', role: 'admin' } });
		next();
	});
	app.use('/analytics', createContentPerformanceRouter(adapter));
	return app;
}

describe('createContentPerformanceRouter', () => {
	let adapter: MemoryAnalyticsAdapter;
	let app: express.Express;

	beforeEach(() => {
		adapter = new MemoryAnalyticsAdapter();
		app = createApp(adapter);
	});

	it('should return 400 when collection is missing', async () => {
		const res = await request(app).get('/analytics/content-performance?documentId=abc');

		expect(res.status).toBe(400);
		expect(res.body.error).toBe('collection and documentId are required');
	});

	it('should return 400 when documentId is missing', async () => {
		const res = await request(app).get('/analytics/content-performance?collection=posts');

		expect(res.status).toBe(400);
		expect(res.body.error).toBe('collection and documentId are required');
	});

	it('should return empty data when no events exist', async () => {
		const res = await request(app).get(
			'/analytics/content-performance?collection=posts&documentId=doc-1',
		);

		expect(res.status).toBe(200);
		expect(res.body.pageViews).toBe(0);
		expect(res.body.uniqueVisitors).toBe(0);
		expect(res.body.topReferrers).toEqual([]);
	});

	it('should aggregate page views for matching document', async () => {
		await adapter.store([
			makeEvent({
				name: 'page_view',
				context: { source: 'client', url: '/posts/doc-1' },
			}),
			makeEvent({
				name: 'page_view',
				context: { source: 'client', url: '/posts/doc-1' },
			}),
			makeEvent({
				name: 'page_view',
				context: { source: 'client', url: '/posts/doc-2' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=posts&documentId=doc-1',
		);

		expect(res.status).toBe(200);
		expect(res.body.pageViews).toBe(2);
	});

	it('should count unique visitors from visitorId and sessionId', async () => {
		await adapter.store([
			makeEvent({
				name: 'page_view',
				visitorId: 'v1',
				context: { source: 'client', url: '/posts/doc-1' },
			}),
			makeEvent({
				name: 'page_view',
				visitorId: 'v1',
				context: { source: 'client', url: '/posts/doc-1' },
			}),
			makeEvent({
				name: 'page_view',
				visitorId: 'v2',
				context: { source: 'client', url: '/posts/doc-1' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=posts&documentId=doc-1',
		);

		expect(res.status).toBe(200);
		expect(res.body.uniqueVisitors).toBe(2);
	});

	it('should aggregate top referrers sorted by count', async () => {
		await adapter.store([
			makeEvent({
				name: 'page_view',
				context: { source: 'client', url: '/posts/doc-1', referrer: 'https://google.com' },
			}),
			makeEvent({
				name: 'page_view',
				context: { source: 'client', url: '/posts/doc-1', referrer: 'https://google.com' },
			}),
			makeEvent({
				name: 'page_view',
				context: { source: 'client', url: '/posts/doc-1', referrer: 'https://twitter.com' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=posts&documentId=doc-1',
		);

		expect(res.status).toBe(200);
		expect(res.body.topReferrers).toHaveLength(2);
		expect(res.body.topReferrers[0].referrer).toBe('https://google.com');
		expect(res.body.topReferrers[0].count).toBe(2);
		expect(res.body.topReferrers[1].referrer).toBe('https://twitter.com');
		expect(res.body.topReferrers[1].count).toBe(1);
	});

	it('should include block engagement when block events exist', async () => {
		await adapter.store([
			makeEvent({
				name: 'page_view',
				category: 'page',
				context: { source: 'client', url: '/posts/doc-1' },
			}),
			makeEvent({
				name: 'block_impression',
				category: 'custom',
				properties: { blockType: 'hero' },
				context: { source: 'client', url: '/posts/doc-1' },
			}),
			makeEvent({
				name: 'block_impression',
				category: 'custom',
				properties: { blockType: 'hero' },
				context: { source: 'client', url: '/posts/doc-1' },
			}),
			makeEvent({
				name: 'block_hover',
				category: 'custom',
				properties: { blockType: 'hero' },
				context: { source: 'client', url: '/posts/doc-1' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=posts&documentId=doc-1',
		);

		expect(res.status).toBe(200);
		expect(res.body.blockEngagement).toBeDefined();
		expect(res.body.blockEngagement).toHaveLength(1);
		expect(res.body.blockEngagement[0].blockType).toBe('hero');
		expect(res.body.blockEngagement[0].impressions).toBe(2);
		expect(res.body.blockEngagement[0].hovers).toBe(1);
	});

	it('should find page views by context.collection + properties.slug (content-attributed events)', async () => {
		await adapter.store([
			// Content-attributed event (from page-view-collector with contentRoutes)
			makeEvent({
				name: 'page_view',
				properties: { collection: 'pages', slug: 'about', path: '/about', statusCode: 200 },
				context: { source: 'server', url: '/about', collection: 'pages' },
			}),
			makeEvent({
				name: 'page_view',
				properties: { collection: 'pages', slug: 'about', path: '/about', statusCode: 200 },
				context: { source: 'server', url: '/about', collection: 'pages' },
			}),
			// Different page — should NOT be counted
			makeEvent({
				name: 'page_view',
				properties: { collection: 'pages', slug: 'contact', path: '/contact', statusCode: 200 },
				context: { source: 'server', url: '/contact', collection: 'pages' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=pages&documentId=about',
		);

		expect(res.status).toBe(200);
		expect(res.body.pageViews).toBe(2);
	});

	it('should work for root-level pages (no /collection/slug URL pattern)', async () => {
		// Root-level pages have URL /about, not /pages/about
		// The old URL-based matching would construct /pages/about and fail
		await adapter.store([
			makeEvent({
				name: 'page_view',
				properties: { collection: 'pages', slug: 'about', path: '/about', statusCode: 200 },
				context: { source: 'server', url: '/about', collection: 'pages' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=pages&documentId=about',
		);

		expect(res.status).toBe(200);
		expect(res.body.pageViews).toBe(1);
	});

	it('should include block engagement for root-level pages with content attribution', async () => {
		await adapter.store([
			makeEvent({
				name: 'page_view',
				properties: { collection: 'pages', slug: 'about', path: '/about', statusCode: 200 },
				context: { source: 'server', url: '/about', collection: 'pages' },
			}),
			makeEvent({
				name: 'block_impression',
				category: 'custom',
				properties: { blockType: 'hero', collection: 'pages', slug: 'about' },
				context: { source: 'client', url: '/about', collection: 'pages' },
			}),
			makeEvent({
				name: 'block_impression',
				category: 'custom',
				properties: { blockType: 'hero', collection: 'pages', slug: 'about' },
				context: { source: 'client', url: '/about', collection: 'pages' },
			}),
			makeEvent({
				name: 'block_hover',
				category: 'custom',
				properties: { blockType: 'hero', collection: 'pages', slug: 'about' },
				context: { source: 'client', url: '/about', collection: 'pages' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=pages&documentId=about',
		);

		expect(res.status).toBe(200);
		expect(res.body.pageViews).toBe(1);
		expect(res.body.blockEngagement).toBeDefined();
		expect(res.body.blockEngagement).toHaveLength(1);
		expect(res.body.blockEngagement[0].blockType).toBe('hero');
		expect(res.body.blockEngagement[0].impressions).toBe(2);
		expect(res.body.blockEngagement[0].hovers).toBe(1);
	});

	it('should find client-side page views where collection is in properties but NOT in context', async () => {
		// Client events from PageViewTrackerService have collection/slug in properties only.
		// The ingest handler strips context.collection for security (whitelist approach).
		await adapter.store([
			makeEvent({
				name: 'page_view',
				properties: { collection: 'pages', slug: 'about', path: '/about' },
				context: { source: 'client', url: 'http://localhost:4200/about' },
			}),
			makeEvent({
				name: 'page_view',
				properties: { collection: 'pages', slug: 'about', path: '/about' },
				context: { source: 'client', url: 'http://localhost:4200/about' },
			}),
			// Different slug — should NOT be counted
			makeEvent({
				name: 'page_view',
				properties: { collection: 'pages', slug: 'contact', path: '/contact' },
				context: { source: 'client', url: 'http://localhost:4200/contact' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=pages&documentId=about',
		);

		expect(res.status).toBe(200);
		expect(res.body.pageViews).toBe(2);
	});

	it('should combine server and client page views for the same document', async () => {
		await adapter.store([
			// Server event — has context.collection
			makeEvent({
				name: 'page_view',
				visitorId: 'v-server',
				properties: { collection: 'pages', slug: 'about', path: '/about', statusCode: 200 },
				context: { source: 'server', url: '/about', collection: 'pages' },
			}),
			// Client event — has properties.collection only (no context.collection)
			makeEvent({
				name: 'page_view',
				visitorId: 'v-client',
				properties: { collection: 'pages', slug: 'about', path: '/about' },
				context: { source: 'client', url: 'http://localhost:4200/about' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=pages&documentId=about',
		);

		expect(res.status).toBe(200);
		expect(res.body.pageViews).toBe(2);
		expect(res.body.uniqueVisitors).toBe(2);
	});

	it('should fall back to URL matching for legacy events without collection/slug', async () => {
		// Legacy events without content attribution — use /${collection}/${documentId} URL pattern
		await adapter.store([
			makeEvent({
				name: 'page_view',
				context: { source: 'client', url: '/articles/my-post' },
			}),
			makeEvent({
				name: 'page_view',
				context: { source: 'client', url: '/articles/my-post' },
			}),
		]);

		const res = await request(app).get(
			'/analytics/content-performance?collection=articles&documentId=my-post',
		);

		expect(res.status).toBe(200);
		expect(res.body.pageViews).toBe(2);
	});

	it('should return 501 when adapter does not support queries', async () => {
		const noQueryAdapter = { store: adapter.store.bind(adapter) };
		const noQueryApp = express();
		noQueryApp.use((_req, _res, next) => {
			Object.assign(_req, { user: { id: 'test-user', role: 'admin' } });
			next();
		});
		noQueryApp.use('/analytics', createContentPerformanceRouter(noQueryAdapter));

		const res = await request(noQueryApp).get(
			'/analytics/content-performance?collection=posts&documentId=doc-1',
		);

		expect(res.status).toBe(501);
		expect(res.body.error).toBe('Analytics adapter does not support queries');
	});
});

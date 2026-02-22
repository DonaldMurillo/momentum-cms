import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRobotsRouter, generateRobotsTxt } from '../robots-handler';
import type { MomentumAPI } from '@momentumcms/plugins/core';

function createApp(
	siteUrl = 'https://example.com',
	config: Parameters<typeof createRobotsRouter>[0]['config'] = {},
	getApi?: () => MomentumAPI | null,
): express.Express {
	const app = express();
	const { router } = createRobotsRouter({ siteUrl, config, getApi });
	app.use(router);
	return app;
}

function makeMockApi(docs: Array<Record<string, unknown>> = []): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			find: vi.fn().mockResolvedValue({ docs }),
		}),
	} as unknown as MomentumAPI;
}

describe('generateRobotsTxt', () => {
	it('should include default User-agent: * Allow: / when no rules provided', () => {
		const txt = generateRobotsTxt('https://example.com', {});
		expect(txt).toContain('User-agent: *');
		expect(txt).toContain('Allow: /');
	});

	it('should include Sitemap URL', () => {
		const txt = generateRobotsTxt('https://example.com', {});
		expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
	});

	it('should include custom disallow rules', () => {
		const txt = generateRobotsTxt('https://example.com', {
			rules: [{ userAgent: '*', disallow: ['/admin', '/api'] }],
		});
		expect(txt).toContain('User-agent: *');
		expect(txt).toContain('Disallow: /admin');
		expect(txt).toContain('Disallow: /api');
	});

	it('should include crawl-delay when configured', () => {
		const txt = generateRobotsTxt('https://example.com', { crawlDelay: 2 });
		expect(txt).toContain('Crawl-delay: 2');
	});

	it('should place Crawl-delay inside the User-agent block (before blank line separator)', () => {
		const txt = generateRobotsTxt('https://example.com', { crawlDelay: 2 });
		const lines = txt.split('\n');
		const crawlDelayIdx = lines.findIndex((l) => l.startsWith('Crawl-delay:'));
		// Find the first blank line after User-agent
		const firstBlankIdx = lines.findIndex((l, i) => i > 0 && l === '');
		expect(crawlDelayIdx).toBeGreaterThan(-1);
		expect(firstBlankIdx).toBeGreaterThan(-1);
		// Crawl-delay must come before the blank line that terminates the User-agent block
		expect(crawlDelayIdx).toBeLessThan(firstBlankIdx);
	});

	it('should place Crawl-delay inside custom rules User-agent block', () => {
		const txt = generateRobotsTxt('https://example.com', {
			rules: [{ userAgent: 'Googlebot', allow: ['/'] }],
			crawlDelay: 5,
		});
		const lines = txt.split('\n');
		const crawlDelayIdx = lines.findIndex((l) => l.startsWith('Crawl-delay:'));
		const userAgentIdx = lines.findIndex((l) => l.startsWith('User-agent:'));
		// Crawl-delay must be between User-agent and the blank line
		const firstBlankAfterAgent = lines.findIndex((l, i) => i > userAgentIdx && l === '');
		expect(crawlDelayIdx).toBeGreaterThan(userAgentIdx);
		expect(crawlDelayIdx).toBeLessThan(firstBlankAfterAgent);
	});

	it('should include additional sitemaps', () => {
		const txt = generateRobotsTxt('https://example.com', {
			additionalSitemaps: ['https://example.com/custom-sitemap.xml'],
		});
		expect(txt).toContain('Sitemap: https://example.com/custom-sitemap.xml');
	});

	it('should omit Sitemap directive when siteUrl is empty', () => {
		const txt = generateRobotsTxt('', {});
		expect(txt).not.toContain('Sitemap:');
	});

	it('should include custom allow rules', () => {
		const txt = generateRobotsTxt('https://example.com', {
			rules: [{ userAgent: 'Googlebot', allow: ['/public'], disallow: ['/private'] }],
		});
		expect(txt).toContain('User-agent: Googlebot');
		expect(txt).toContain('Allow: /public');
		expect(txt).toContain('Disallow: /private');
	});
});

describe('Robots Handler', () => {
	it('GET /robots.txt should return 200 with content-type text/plain', async () => {
		const app = createApp();
		const res = await request(app).get('/robots.txt');
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toContain('text/plain');
	});

	it('should include default User-agent: * Allow: /', async () => {
		const app = createApp();
		const res = await request(app).get('/robots.txt');
		expect(res.text).toContain('User-agent: *');
		expect(res.text).toContain('Allow: /');
	});

	it('should derive Sitemap URL from request Host header', async () => {
		const app = createApp('https://mysite.com');
		const res = await request(app).get('/robots.txt').set('Host', 'mysite.com');
		expect(res.text).toContain('Sitemap: http://mysite.com/sitemap.xml');
	});

	it('should include custom disallow rules from config', async () => {
		const app = createApp('https://example.com', {
			rules: [{ userAgent: '*', disallow: ['/admin', '/private'] }],
		});
		const res = await request(app).get('/robots.txt');
		expect(res.text).toContain('Disallow: /admin');
		expect(res.text).toContain('Disallow: /private');
	});

	it('should include crawl-delay when configured', async () => {
		const app = createApp('https://example.com', { crawlDelay: 1 });
		const res = await request(app).get('/robots.txt');
		expect(res.text).toContain('Crawl-delay: 1');
	});

	it('should return { router, clearCache }', () => {
		const result = createRobotsRouter({
			siteUrl: 'https://example.com',
			config: {},
		});
		expect(result.router).toBeDefined();
		expect(typeof result.clearCache).toBe('function');
	});
});

describe('Robots Handler with dynamic DB settings', () => {
	it('should use DB settings when available', async () => {
		const api = makeMockApi([
			{
				id: 'settings-1',
				robotsRules: [{ userAgent: 'Bingbot', allow: ['/'], disallow: ['/secret'] }],
				robotsCrawlDelay: 3,
				robotsAdditionalSitemaps: [],
			},
		]);
		const app = createApp('https://example.com', {}, () => api);
		const res = await request(app).get('/robots.txt');

		expect(res.text).toContain('User-agent: Bingbot');
		expect(res.text).toContain('Disallow: /secret');
		expect(res.text).toContain('Crawl-delay: 3');
	});

	it('should fall back to static config when no DB settings', async () => {
		const api = makeMockApi([]);
		const app = createApp(
			'https://example.com',
			{ rules: [{ userAgent: '*', disallow: ['/admin'] }] },
			() => api,
		);
		const res = await request(app).get('/robots.txt');

		expect(res.text).toContain('Disallow: /admin');
	});

	it('should fall back to static config when API is not ready', async () => {
		const app = createApp(
			'https://example.com',
			{ rules: [{ userAgent: '*', disallow: ['/api'] }] },
			() => null,
		);
		const res = await request(app).get('/robots.txt');

		expect(res.text).toContain('Disallow: /api');
	});

	it('should cache robots.txt content', async () => {
		const findFn = vi.fn().mockResolvedValue({
			docs: [
				{
					id: 's1',
					robotsRules: [{ userAgent: '*', disallow: ['/cached'] }],
				},
			],
		});
		const api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
		} as unknown as MomentumAPI;

		const app = express();
		const { router } = createRobotsRouter({
			siteUrl: 'https://example.com',
			config: {},
			getApi: () => api,
		});
		app.use(router);

		// First request — hits DB
		await request(app).get('/robots.txt');
		expect(findFn).toHaveBeenCalledTimes(1);

		// Second request — should use cache
		const res2 = await request(app).get('/robots.txt');
		expect(findFn).toHaveBeenCalledTimes(1); // Still 1 — cached
		expect(res2.text).toContain('Disallow: /cached');
	});

	it('clearCache should invalidate cached content', async () => {
		const findFn = vi.fn().mockResolvedValue({
			docs: [
				{
					id: 's1',
					robotsRules: [{ userAgent: '*', disallow: ['/v1'] }],
				},
			],
		});
		const api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
		} as unknown as MomentumAPI;

		const app = express();
		const { router, clearCache } = createRobotsRouter({
			siteUrl: 'https://example.com',
			config: {},
			getApi: () => api,
		});
		app.use(router);

		// First request populates cache
		await request(app).get('/robots.txt');
		expect(findFn).toHaveBeenCalledTimes(1);

		// Clear cache and update mock for new response
		clearCache();
		findFn.mockResolvedValueOnce({
			docs: [
				{
					id: 's1',
					robotsRules: [{ userAgent: '*', disallow: ['/v2'] }],
				},
			],
		});

		// Next request should hit DB again
		const res = await request(app).get('/robots.txt');
		expect(findFn).toHaveBeenCalledTimes(2);
		expect(res.text).toContain('Disallow: /v2');
	});
});

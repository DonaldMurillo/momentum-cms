import { describe, it, expect, vi } from 'vitest';
import {
	createPageViewCollectorMiddleware,
	isBot,
	shouldExcludePath,
} from '../collectors/page-view-collector';
import type { AnalyticsEvent } from '../analytics-event.types';
import type { Request, Response } from 'express';
import { EventEmitter } from 'node:events';

// --- Test helpers (mirror api-collector.spec.ts pattern) ---

function createMockReq(overrides: Partial<Request> = {}): Request {
	return {
		method: 'GET',
		path: '/blog/my-post',
		originalUrl: '/blog/my-post',
		headers: {
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
		},
		ip: '127.0.0.1',
		socket: { remoteAddress: '127.0.0.1' },
		...overrides,
	} as Request;
}

function createMockRes(): Response {
	const emitter = new EventEmitter();
	const res = emitter as unknown as Response;
	res.statusCode = 200;
	return res;
}

// --- isBot utility tests ---

describe('isBot', () => {
	it('should return false for undefined', () => {
		expect(isBot(undefined)).toBe(false);
	});

	it('should return false for a standard browser user-agent', () => {
		expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')).toBe(false);
	});

	it('should return true for Googlebot', () => {
		expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(
			true,
		);
	});

	it('should return true for Bingbot', () => {
		expect(isBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(
			true,
		);
	});

	it('should return true for generic crawlers', () => {
		expect(isBot('SomeWebCrawler/1.0')).toBe(true);
	});

	it('should return true for social media bots', () => {
		expect(isBot('facebookexternalhit/1.1')).toBe(true);
		expect(isBot('Twitterbot/1.0')).toBe(true);
		expect(isBot('LinkedInBot/1.0')).toBe(true);
	});
});

// --- shouldExcludePath utility tests ---

describe('shouldExcludePath', () => {
	const defaultExtensions = new Set(['.js', '.css', '.png', '.svg', '.ico']);

	it('should exclude /api/posts', () => {
		expect(shouldExcludePath('/api/posts', defaultExtensions, [])).toBe(true);
	});

	it('should exclude exact /api path', () => {
		expect(shouldExcludePath('/api', defaultExtensions, [])).toBe(true);
	});

	it('should not exclude /blog/my-post', () => {
		expect(shouldExcludePath('/blog/my-post', defaultExtensions, [])).toBe(false);
	});

	it('should exclude /favicon.ico', () => {
		expect(shouldExcludePath('/favicon.ico', defaultExtensions, [])).toBe(true);
	});

	it('should exclude /robots.txt', () => {
		expect(shouldExcludePath('/robots.txt', defaultExtensions, [])).toBe(true);
	});

	it('should exclude /sitemap.xml', () => {
		expect(shouldExcludePath('/sitemap.xml', defaultExtensions, [])).toBe(true);
	});

	it('should exclude Vite dev server paths', () => {
		expect(shouldExcludePath('/__vite/client', defaultExtensions, [])).toBe(true);
		expect(shouldExcludePath('/@fs/some/path', defaultExtensions, [])).toBe(true);
		expect(shouldExcludePath('/@id/module', defaultExtensions, [])).toBe(true);
	});

	it('should exclude static assets by extension', () => {
		expect(shouldExcludePath('/assets/main.js', defaultExtensions, [])).toBe(true);
		expect(shouldExcludePath('/styles/app.css', defaultExtensions, [])).toBe(true);
		expect(shouldExcludePath('/images/logo.png', defaultExtensions, [])).toBe(true);
	});

	it('should not exclude paths with non-static extensions', () => {
		expect(shouldExcludePath('/blog/my-post.html', defaultExtensions, [])).toBe(false);
	});

	it('should respect custom excludePaths', () => {
		expect(shouldExcludePath('/admin/dashboard', defaultExtensions, ['/admin'])).toBe(true);
		expect(shouldExcludePath('/blog/post', defaultExtensions, ['/admin'])).toBe(false);
	});
});

// --- createPageViewCollectorMiddleware tests ---

describe('createPageViewCollectorMiddleware', () => {
	it('should call next immediately', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const next = vi.fn();
		middleware(createMockReq(), createMockRes(), next);

		expect(next).toHaveBeenCalledOnce();
	});

	it('should emit a page_view event on response finish', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq(), res, vi.fn());

		res.emit('finish');

		expect(emitter).toHaveBeenCalledOnce();
		const event = emitter.mock.calls[0][0];
		expect(event.category).toBe('page');
		expect(event.name).toBe('page_view');
		expect(event.context.source).toBe('server');
	});

	it('should capture path, method, and statusCode in properties', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq({ path: '/about', originalUrl: '/about' }), res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.properties['method']).toBe('GET');
		expect(event.properties['path']).toBe('/about');
		expect(event.properties['statusCode']).toBe(200);
	});

	it('should measure elapsed time as duration', () => {
		vi.useFakeTimers();
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq(), res, vi.fn());

		vi.advanceTimersByTime(150);
		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.context.duration).toBeGreaterThanOrEqual(150);
		expect(typeof event.context.duration).toBe('number');
		vi.useRealTimers();
	});

	it('should capture user-agent, IP, device, browser, and OS in context', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq(), res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.context.ip).toBe('127.0.0.1');
		expect(event.context.device).toBe('desktop');
		expect(event.context.browser).toBe('Chrome');
		expect(event.context.os).toBe('Windows');
		expect(event.context.url).toBe('/blog/my-post');
	});

	it('should capture referrer from headers', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		const req = createMockReq({
			headers: {
				'user-agent': 'Mozilla/5.0 Chrome/120.0',
				referer: 'https://google.com/search?q=test',
			},
		} as Partial<Request>);
		middleware(req, res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.context.referrer).toBe('https://google.com/search?q=test');
	});

	it('should generate unique event IDs', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res1 = createMockRes();
		const res2 = createMockRes();
		middleware(createMockReq(), res1, vi.fn());
		middleware(createMockReq({ path: '/other', originalUrl: '/other' }), res2, vi.fn());

		res1.emit('finish');
		res2.emit('finish');

		const id1 = emitter.mock.calls[0][0].id;
		const id2 = emitter.mock.calls[1][0].id;
		expect(id1).not.toBe(id2);
	});

	it('should capture userId from req.user when authenticated', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		const req = createMockReq();
		Object.assign(req, { user: { id: 'user-123', email: 'test@example.com', role: 'admin' } });
		middleware(req, res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.userId).toBe('user-123');
	});

	it('should not set userId when req.user is absent', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq(), res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.userId).toBeUndefined();
	});

	// --- Filtering tests ---

	it('should NOT track API paths (/api/*)', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq({ path: '/api/posts', originalUrl: '/api/posts' }), res, vi.fn());

		res.emit('finish');

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should NOT track static assets (.js, .css, .png)', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		for (const ext of ['.js', '.css', '.png', '.svg', '.woff2', '.map']) {
			const res = createMockRes();
			middleware(
				createMockReq({ path: `/assets/file${ext}`, originalUrl: `/assets/file${ext}` }),
				res,
				vi.fn(),
			);
			res.emit('finish');
		}

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should NOT track favicon.ico, robots.txt, sitemap.xml', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		for (const path of ['/favicon.ico', '/robots.txt', '/sitemap.xml']) {
			const res = createMockRes();
			middleware(createMockReq({ path, originalUrl: path }), res, vi.fn());
			res.emit('finish');
		}

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should NOT track Vite dev server paths', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		for (const path of ['/__vite/client', '/@fs/some/module', '/@id/something']) {
			const res = createMockRes();
			middleware(createMockReq({ path, originalUrl: path }), res, vi.fn());
			res.emit('finish');
		}

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should NOT track non-GET requests', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
			const res = createMockRes();
			middleware(createMockReq({ method }), res, vi.fn());
			res.emit('finish');
		}

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should NOT track bot traffic by default', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(
			createMockReq({
				headers: {
					'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
				},
			} as Partial<Request>),
			res,
			vi.fn(),
		);

		res.emit('finish');

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should track bot traffic when trackBots is true', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter, { trackBots: true });

		const res = createMockRes();
		middleware(
			createMockReq({
				headers: {
					'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
				},
			} as Partial<Request>),
			res,
			vi.fn(),
		);

		res.emit('finish');

		expect(emitter).toHaveBeenCalledOnce();
	});

	it('should NOT emit for non-2xx responses when onlySuccessful is true (default)', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		for (const statusCode of [301, 404, 500]) {
			const res = createMockRes();
			res.statusCode = statusCode;
			middleware(createMockReq(), res, vi.fn());
			res.emit('finish');
		}

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should emit for non-2xx responses when onlySuccessful is false', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter, { onlySuccessful: false });

		const res = createMockRes();
		res.statusCode = 404;
		middleware(createMockReq(), res, vi.fn());

		res.emit('finish');

		expect(emitter).toHaveBeenCalledOnce();
		expect(emitter.mock.calls[0][0].context.statusCode).toBe(404);
	});

	it('should respect custom excludePaths', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter, {
			excludePaths: ['/admin', '/internal'],
		});

		const res = createMockRes();
		middleware(
			createMockReq({ path: '/admin/dashboard', originalUrl: '/admin/dashboard' }),
			res,
			vi.fn(),
		);

		res.emit('finish');

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should respect custom excludeExtensions', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter, {
			excludeExtensions: ['.html', '.pdf'],
		});

		const res = createMockRes();
		middleware(
			createMockReq({ path: '/docs/guide.pdf', originalUrl: '/docs/guide.pdf' }),
			res,
			vi.fn(),
		);

		res.emit('finish');

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should still track normal pages when custom excludeExtensions replaces defaults', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter, {
			excludeExtensions: ['.pdf'],
		});

		// .js would be excluded by default extensions, but custom replaces them
		const res = createMockRes();
		middleware(
			createMockReq({ path: '/assets/app.js', originalUrl: '/assets/app.js' }),
			res,
			vi.fn(),
		);

		res.emit('finish');

		expect(emitter).toHaveBeenCalledOnce();
	});

	// --- Full event shape and edge case tests (from test review) ---

	it('should produce a complete AnalyticsEvent with all required fields', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq(), res, vi.fn());
		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event).toMatchObject({
			id: expect.any(String),
			category: 'page',
			name: 'page_view',
			timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
			properties: { method: 'GET', path: '/blog/my-post', statusCode: 200 },
			context: {
				source: 'server',
				url: '/blog/my-post',
				userAgent: expect.any(String),
				ip: '127.0.0.1',
				device: 'desktop',
				browser: 'Chrome',
				os: 'Windows',
				duration: expect.any(Number),
				statusCode: 200,
			},
		});
	});

	it('should not set userId when req.user.id is a number', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		const req = createMockReq();
		Object.assign(req, { user: { id: 42 } });
		middleware(req, res, vi.fn());
		res.emit('finish');

		expect(emitter.mock.calls[0][0].userId).toBeUndefined();
	});

	it('should not set userId when req.user is null', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		const req = createMockReq();
		Object.assign(req, { user: null });
		middleware(req, res, vi.fn());
		res.emit('finish');

		expect(emitter.mock.calls[0][0].userId).toBeUndefined();
	});

	it('should fall back to req.socket.remoteAddress when req.ip is undefined', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		const req = createMockReq({ ip: undefined });
		middleware(req, res, vi.fn());
		res.emit('finish');

		expect(emitter.mock.calls[0][0].context.ip).toBe('127.0.0.1');
	});

	it('should emit for status 200 and 299 (2xx boundaries)', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		for (const statusCode of [200, 299]) {
			const res = createMockRes();
			res.statusCode = statusCode;
			middleware(createMockReq(), res, vi.fn());
			res.emit('finish');
		}

		expect(emitter).toHaveBeenCalledTimes(2);
	});

	it('should NOT emit for status 199 or 300 when onlySuccessful is true', () => {
		const emitter = vi.fn();
		const middleware = createPageViewCollectorMiddleware(emitter);

		for (const statusCode of [199, 300]) {
			const res = createMockRes();
			res.statusCode = statusCode;
			middleware(createMockReq(), res, vi.fn());
			res.emit('finish');
		}

		expect(emitter).not.toHaveBeenCalled();
	});

	it('should handle missing user-agent header gracefully', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createPageViewCollectorMiddleware(emitter);

		const res = createMockRes();
		const req = createMockReq({ headers: {} } as Partial<Request>);
		middleware(req, res, vi.fn());
		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.context.device).toBe('unknown');
		expect(event.context.browser).toBe('unknown');
		expect(event.context.os).toBe('unknown');
	});

	// --- Content route matching tests ---

	describe('with contentRoutes', () => {
		const contentRoutes = {
			articles: '/articles/:slug',
			categories: '/categories/:slug',
			pages: '/:slug',
		};

		it('should include collection and slug in properties when contentRoutes matches', () => {
			const emitter = vi.fn<(event: AnalyticsEvent) => void>();
			const middleware = createPageViewCollectorMiddleware(emitter, { contentRoutes });

			const res = createMockRes();
			middleware(
				createMockReq({ path: '/articles/my-post', originalUrl: '/articles/my-post' }),
				res,
				vi.fn(),
			);
			res.emit('finish');

			const event = emitter.mock.calls[0][0];
			expect(event.properties['collection']).toBe('articles');
			expect(event.properties['slug']).toBe('my-post');
		});

		it('should set context.collection when contentRoutes matches', () => {
			const emitter = vi.fn<(event: AnalyticsEvent) => void>();
			const middleware = createPageViewCollectorMiddleware(emitter, { contentRoutes });

			const res = createMockRes();
			middleware(
				createMockReq({ path: '/articles/my-post', originalUrl: '/articles/my-post' }),
				res,
				vi.fn(),
			);
			res.emit('finish');

			const event = emitter.mock.calls[0][0];
			expect(event.context.collection).toBe('articles');
		});

		it('should NOT include collection/slug when path does not match any route', () => {
			const emitter = vi.fn<(event: AnalyticsEvent) => void>();
			const middleware = createPageViewCollectorMiddleware(emitter, {
				contentRoutes: { articles: '/articles/:slug' },
			});

			const res = createMockRes();
			middleware(
				createMockReq({ path: '/blog/my-post', originalUrl: '/blog/my-post' }),
				res,
				vi.fn(),
			);
			res.emit('finish');

			const event = emitter.mock.calls[0][0];
			expect(event.properties['collection']).toBeUndefined();
			expect(event.properties['slug']).toBeUndefined();
			expect(event.context.collection).toBeUndefined();
		});

		it('should prefer specific route over catch-all', () => {
			const emitter = vi.fn<(event: AnalyticsEvent) => void>();
			const middleware = createPageViewCollectorMiddleware(emitter, { contentRoutes });

			const res = createMockRes();
			middleware(
				createMockReq({ path: '/articles/hello', originalUrl: '/articles/hello' }),
				res,
				vi.fn(),
			);
			res.emit('finish');

			const event = emitter.mock.calls[0][0];
			expect(event.properties['collection']).toBe('articles');
		});

		it('should not include collection/slug when contentRoutes is not configured', () => {
			const emitter = vi.fn<(event: AnalyticsEvent) => void>();
			const middleware = createPageViewCollectorMiddleware(emitter);

			const res = createMockRes();
			middleware(
				createMockReq({ path: '/articles/my-post', originalUrl: '/articles/my-post' }),
				res,
				vi.fn(),
			);
			res.emit('finish');

			const event = emitter.mock.calls[0][0];
			expect(event.properties['collection']).toBeUndefined();
			expect(event.properties['slug']).toBeUndefined();
			expect(event.context.collection).toBeUndefined();
		});

		it('should handle root-level :slug pattern correctly', () => {
			const emitter = vi.fn<(event: AnalyticsEvent) => void>();
			const middleware = createPageViewCollectorMiddleware(emitter, { contentRoutes });

			const res = createMockRes();
			middleware(createMockReq({ path: '/about', originalUrl: '/about' }), res, vi.fn());
			res.emit('finish');

			const event = emitter.mock.calls[0][0];
			expect(event.properties['collection']).toBe('pages');
			expect(event.properties['slug']).toBe('about');
			expect(event.context.collection).toBe('pages');
		});
	});
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createSeoSettingsRouter } from '../seo-settings-handler';
import type { MomentumAPI } from '@momentumcms/plugins/core';

function makeReq(overrides: Partial<Request> = {}): Request {
	return { user: { role: 'admin' }, body: {}, params: {}, ...overrides } as unknown as Request;
}

function makeRes(): Response & { _status: number; _json: unknown } {
	const res = {
		_status: 200,
		_json: null,
		status(code: number) {
			res._status = code;
			return res;
		},
		json(data: unknown) {
			res._json = data;
			return res;
		},
	};
	return res as unknown as Response & { _status: number; _json: unknown };
}

function makeMockApi(docs: Array<Record<string, unknown>> = []): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			find: vi.fn().mockResolvedValue({ docs }),
			create: vi
				.fn()
				.mockImplementation((data: Record<string, unknown>) =>
					Promise.resolve({ id: 'new-id', ...data }),
				),
			update: vi
				.fn()
				.mockImplementation((id: string, data: Record<string, unknown>) =>
					Promise.resolve({ id, ...data }),
				),
		}),
	} as unknown as MomentumAPI;
}

describe('createSeoSettingsRouter', () => {
	let onSettingsChanged: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onSettingsChanged = vi.fn();
	});

	describe('GET /seo-settings', () => {
		it('should return 401 for non-admin users', async () => {
			const api = makeMockApi();
			const router = createSeoSettingsRouter({ getApi: () => api });
			const handler = getRouteHandler(router, 'get', '/seo-settings');
			const res = makeRes();

			await handler(makeReq({ user: undefined } as never), res);

			expect(res._status).toBe(401);
		});

		it('should return 503 when API is not ready', async () => {
			const router = createSeoSettingsRouter({ getApi: () => null });
			const handler = getRouteHandler(router, 'get', '/seo-settings');
			const res = makeRes();

			await handler(makeReq(), res);

			expect(res._status).toBe(503);
		});

		it('should return saved settings when they exist', async () => {
			const savedDoc = {
				id: 'doc-1',
				robotsRules: [{ userAgent: 'Googlebot', allow: ['/'], disallow: ['/private'] }],
				robotsCrawlDelay: 10,
				robotsAdditionalSitemaps: ['https://example.com/extra-sitemap.xml'],
			};
			const api = makeMockApi([savedDoc]);
			const router = createSeoSettingsRouter({ getApi: () => api });
			const handler = getRouteHandler(router, 'get', '/seo-settings');
			const res = makeRes();

			await handler(makeReq(), res);

			expect(res._status).toBe(200);
			expect(res._json).toEqual(savedDoc);
		});

		it('should return defaults when no saved settings exist', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({
				getApi: () => api,
				defaultRobotsConfig: {
					rules: [{ userAgent: '*', allow: ['/'], disallow: ['/admin'] }],
					crawlDelay: 5,
					additionalSitemaps: [],
				},
			});
			const handler = getRouteHandler(router, 'get', '/seo-settings');
			const res = makeRes();

			await handler(makeReq(), res);

			expect(res._status).toBe(200);
			const json = res._json as Record<string, unknown>;
			expect(json['robotsRules']).toEqual([{ userAgent: '*', allow: ['/'], disallow: ['/admin'] }]);
			expect(json['robotsCrawlDelay']).toBe(5);
			expect(json['robotsAdditionalSitemaps']).toEqual([]);
		});

		it('should return fallback defaults when no config at all', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({ getApi: () => api });
			const handler = getRouteHandler(router, 'get', '/seo-settings');
			const res = makeRes();

			await handler(makeReq(), res);

			expect(res._status).toBe(200);
			const json = res._json as Record<string, unknown>;
			expect(json['robotsRules']).toEqual([{ userAgent: '*', allow: ['/'], disallow: [] }]);
			expect(json['robotsCrawlDelay']).toBeNull();
			expect(json['robotsAdditionalSitemaps']).toEqual([]);
		});
	});

	describe('PUT /seo-settings', () => {
		it('should return 401 for non-admin users', async () => {
			const api = makeMockApi();
			const router = createSeoSettingsRouter({ getApi: () => api });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(makeReq({ user: undefined } as never), res);

			expect(res._status).toBe(401);
		});

		it('should create new settings when none exist', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({ getApi: () => api, onSettingsChanged });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(
				makeReq({
					body: {
						robotsRules: [{ userAgent: '*', disallow: ['/secret'] }],
						robotsCrawlDelay: 2,
					},
				}),
				res,
			);

			expect(res._status).toBe(200);
			expect(onSettingsChanged).toHaveBeenCalledTimes(1);
			const json = res._json as Record<string, unknown>;
			expect(json['robotsRules']).toEqual([{ userAgent: '*', allow: [], disallow: ['/secret'] }]);
		});

		it('should update existing settings', async () => {
			const api = makeMockApi([{ id: 'existing-id', robotsRules: [] }]);
			const router = createSeoSettingsRouter({ getApi: () => api, onSettingsChanged });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(
				makeReq({
					body: { robotsCrawlDelay: 5 },
				}),
				res,
			);

			expect(res._status).toBe(200);
			expect(onSettingsChanged).toHaveBeenCalledTimes(1);
			const collApi = api.collection('seo-settings') as { update: ReturnType<typeof vi.fn> };
			expect(collApi.update).toHaveBeenCalledWith('existing-id', { robotsCrawlDelay: 5 });
		});

		it('should clamp crawl delay to minimum 0', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({ getApi: () => api });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(makeReq({ body: { robotsCrawlDelay: -5 } }), res);

			const json = res._json as Record<string, unknown>;
			expect(json['robotsCrawlDelay']).toBe(0);
		});

		it('should strip newlines from robotsRules userAgent values', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({ getApi: () => api, onSettingsChanged });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(
				makeReq({
					body: {
						robotsRules: [{ userAgent: 'Googlebot\nDisallow: /', allow: ['/'], disallow: [] }],
					},
				}),
				res,
			);

			expect(res._status).toBe(200);
			const json = res._json as Record<string, unknown>;
			const rules = json['robotsRules'] as Array<{ userAgent: string }>;
			expect(rules[0].userAgent).not.toContain('\n');
		});

		it('should strip newlines from robotsRules paths', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({ getApi: () => api, onSettingsChanged });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(
				makeReq({
					body: {
						robotsRules: [{ userAgent: '*', allow: ['/ok\nDisallow: /secret'], disallow: [] }],
					},
				}),
				res,
			);

			expect(res._status).toBe(200);
			const json = res._json as Record<string, unknown>;
			const rules = json['robotsRules'] as Array<{ allow: string[] }>;
			expect(rules[0].allow[0]).not.toContain('\n');
		});

		it('should strip newlines from robotsAdditionalSitemaps', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({ getApi: () => api, onSettingsChanged });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(
				makeReq({
					body: {
						robotsAdditionalSitemaps: ['https://example.com/sitemap.xml\nDisallow: /'],
					},
				}),
				res,
			);

			expect(res._status).toBe(200);
			const json = res._json as Record<string, unknown>;
			const sitemaps = json['robotsAdditionalSitemaps'] as string[];
			expect(sitemaps[0]).not.toContain('\n');
		});

		it('should reject non-array robotsRules', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({ getApi: () => api });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(makeReq({ body: { robotsRules: 'not an array' } }), res);

			expect(res._status).toBe(400);
		});

		it('should reject non-array robotsAdditionalSitemaps', async () => {
			const api = makeMockApi([]);
			const router = createSeoSettingsRouter({ getApi: () => api });
			const handler = getRouteHandler(router, 'put', '/seo-settings');
			const res = makeRes();

			await handler(makeReq({ body: { robotsAdditionalSitemaps: 'not an array' } }), res);

			expect(res._status).toBe(400);
		});
	});
});

/**
 * Extract a route handler from an Express router by method and path.
 */
function getRouteHandler(
	router: ReturnType<typeof createSeoSettingsRouter>,
	method: 'get' | 'put',
	path: string,
): (req: Request, res: Response) => Promise<void> {
	const stack = (router as any).stack as Array<{
		route?: {
			path: string;
			methods: Record<string, boolean>;
			stack: Array<{ handle: (...args: unknown[]) => unknown }>;
		};
	}>;
	for (const layer of stack) {
		if (layer.route?.path === path && layer.route.methods[method]) {
			return layer.route.stack[0].handle as (req: Request, res: Response) => Promise<void>;
		}
	}
	throw new Error(`No ${method.toUpperCase()} handler found for ${path}`);
}

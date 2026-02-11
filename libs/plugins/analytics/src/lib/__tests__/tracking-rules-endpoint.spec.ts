import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
	createTrackingRulesRouter,
	type TrackingRulesEndpointOptions,
} from '../tracking-rules/tracking-rules-endpoint';
import type { MomentumAPI } from '@momentum-cms/core';

function makeRule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: `rule-${Math.random().toString(36).slice(2, 8)}`,
		name: 'CTA Click',
		selector: '.cta-button',
		eventType: 'click',
		eventName: 'cta_click',
		urlPattern: '*',
		properties: { section: 'header' },
		active: true,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

function createMockApi(docs: Record<string, unknown>[] = []): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			find: vi.fn().mockResolvedValue({ docs }),
		}),
		getConfig: vi.fn(),
	} as unknown as MomentumAPI;
}

function createApp(
	getApi: () => MomentumAPI | null,
	options?: TrackingRulesEndpointOptions,
): express.Express {
	const result = createTrackingRulesRouter(getApi, options);
	const app = express();
	app.use('/analytics', result.router);
	return app;
}

function createAppWithInvalidation(
	getApi: () => MomentumAPI | null,
	options?: TrackingRulesEndpointOptions,
): { app: express.Express; invalidateCache: () => void } {
	const result = createTrackingRulesRouter(getApi, options);
	const app = express();
	app.use('/analytics', result.router);
	return { app, invalidateCache: result.invalidateCache };
}

describe('createTrackingRulesRouter', () => {
	let api: MomentumAPI;

	beforeEach(() => {
		api = createMockApi([]);
	});

	it('should return empty rules when api is not available', async () => {
		const app = createApp(() => null);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toEqual([]);
	});

	it('should return empty rules when collection is not findable', async () => {
		const badApi = {
			collection: vi.fn().mockReturnValue('not-an-object'),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;
		const app = createApp(() => badApi);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toEqual([]);
	});

	it('should return active rules with internal fields stripped', async () => {
		const rule = makeRule();
		api = createMockApi([rule]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toHaveLength(1);
		expect(res.body.rules[0].name).toBe('CTA Click');
		expect(res.body.rules[0].selector).toBe('.cta-button');
		expect(res.body.rules[0].eventType).toBe('click');
		expect(res.body.rules[0].eventName).toBe('cta_click');
		expect(res.body.rules[0].urlPattern).toBe('*');
		expect(res.body.rules[0].active).toBe(true);
		// Internal fields should not be present
		expect(res.body.rules[0].id).toBeUndefined();
		expect(res.body.rules[0].createdAt).toBeUndefined();
		expect(res.body.rules[0].updatedAt).toBeUndefined();
	});

	it('should filter out invalid documents', async () => {
		api = createMockApi([
			makeRule(),
			{ invalid: true }, // missing name + selector
			makeRule({ name: 'Valid 2', selector: '#submit' }),
		]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toHaveLength(2);
		expect(res.body.rules[0].name).toBe('CTA Click');
		expect(res.body.rules[1].name).toBe('Valid 2');
	});

	it('should default eventType to click when missing', async () => {
		api = createMockApi([makeRule({ eventType: undefined })]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.body.rules[0].eventType).toBe('click');
	});

	it('should default urlPattern to * when missing', async () => {
		api = createMockApi([makeRule({ urlPattern: undefined })]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.body.rules[0].urlPattern).toBe('*');
	});

	it('should cache rules and serve from cache on subsequent requests', async () => {
		api = createMockApi([makeRule()]);
		const app = createApp(() => api);

		const res1 = await request(app).get('/analytics/tracking-rules');
		expect(res1.status).toBe(200);
		expect(res1.body.rules).toHaveLength(1);

		const res2 = await request(app).get('/analytics/tracking-rules');
		expect(res2.status).toBe(200);
		expect(res2.body.rules).toHaveLength(1);

		// The collection find should only be called once due to caching
		const collectionOps = api.collection('tracking-rules') as { find: ReturnType<typeof vi.fn> };
		expect(collectionOps.find).toHaveBeenCalledTimes(1);
	});

	it('should refresh cache after TTL expires', async () => {
		const findFn = vi
			.fn()
			.mockResolvedValueOnce({ docs: [makeRule({ name: 'First' })] })
			.mockResolvedValueOnce({ docs: [makeRule({ name: 'Second' })] });
		api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		// Use a very short cache TTL
		const app = createApp(() => api, { cacheTtl: 1 });

		const res1 = await request(app).get('/analytics/tracking-rules');
		expect(res1.body.rules[0].name).toBe('First');

		// Wait for cache to expire
		await new Promise((resolve) => setTimeout(resolve, 5));

		const res2 = await request(app).get('/analytics/tracking-rules');
		expect(res2.body.rules[0].name).toBe('Second');
		expect(findFn).toHaveBeenCalledTimes(2);
	});

	it('should return 500 with generic error on query failure', async () => {
		const errorApi = {
			collection: vi.fn().mockReturnValue({
				find: vi.fn().mockRejectedValue(new Error('DB connection failed')),
			}),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;
		const app = createApp(() => errorApi);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(500);
		// Error message should NOT leak internal details
		expect(res.body.error).toBe('Internal server error');
	});

	it('should filter out rules targeting password inputs', async () => {
		api = createMockApi([
			makeRule({ selector: 'input[type="password"]', name: 'Blocked' }),
			makeRule({ selector: '.cta-button', name: 'Allowed' }),
		]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toHaveLength(1);
		expect(res.body.rules[0].name).toBe('Allowed');
	});

	it('should filter out rules using non-hex CSS escape bypass for password inputs', async () => {
		api = createMockApi([
			makeRule({ selector: 'input[type=\\password]', name: 'Bypass Blocked' }),
			makeRule({ selector: '.cta-button', name: 'Allowed' }),
		]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toHaveLength(1);
		expect(res.body.rules[0].name).toBe('Allowed');
	});

	it('should filter out rules using non-hex CSS escape bypass for hidden inputs', async () => {
		api = createMockApi([
			makeRule({ selector: 'input[type=\\hidden]', name: 'Bypass Blocked' }),
			makeRule({ selector: '#signup-form', name: 'Allowed' }),
		]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toHaveLength(1);
		expect(res.body.rules[0].name).toBe('Allowed');
	});

	it('should filter out rules using multiple non-hex CSS escape bypasses', async () => {
		api = createMockApi([
			makeRule({ selector: 'input[type=\\passw\\ord]', name: 'Multi Bypass Blocked' }),
			makeRule({ selector: '.safe-btn', name: 'Allowed' }),
		]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toHaveLength(1);
		expect(res.body.rules[0].name).toBe('Allowed');
	});

	it('should filter out rules using hex escape with trailing space + non-hex bypass', async () => {
		// \70 followed by a space (consumed by CSS hex escape) resolves to 'p'
		// \word resolves to 'word' via non-hex escape of \w
		api = createMockApi([
			makeRule({ selector: 'input[type=\\70 ass\\word]', name: 'Mixed Bypass Blocked' }),
			makeRule({ selector: '.safe-btn', name: 'Allowed' }),
		]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toHaveLength(1);
		expect(res.body.rules[0].name).toBe('Allowed');
	});

	it('should filter out rules targeting hidden inputs', async () => {
		api = createMockApi([
			makeRule({ selector: 'input[type=hidden]', name: 'Blocked' }),
			makeRule({ selector: '#signup-form', name: 'Allowed' }),
		]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		expect(res.body.rules).toHaveLength(1);
		expect(res.body.rules[0].name).toBe('Allowed');
	});

	it('should strip blocked attributes from extractProperties', async () => {
		api = createMockApi([
			makeRule({
				extractProperties: [
					{ key: 'text', source: 'text' },
					{ key: 'val', source: 'attribute', attribute: 'value' },
					{ key: 'cls', source: 'attribute', attribute: 'class' },
				],
			}),
		]);
		const app = createApp(() => api);

		const res = await request(app).get('/analytics/tracking-rules');

		expect(res.status).toBe(200);
		const extract = res.body.rules[0].extractProperties;
		// 'value' attribute should be stripped, 'text' and 'class' should remain
		expect(extract).toHaveLength(2);
		expect(extract[0].key).toBe('text');
		expect(extract[1].key).toBe('cls');
	});

	it('should pass active filter and limit to collection find', async () => {
		const findFn = vi.fn().mockResolvedValue({ docs: [] });
		api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;
		const app = createApp(() => api);

		await request(app).get('/analytics/tracking-rules');

		expect(findFn).toHaveBeenCalledWith({
			where: { active: { equals: true } },
			limit: 500,
		});
	});

	it('should re-fetch rules from DB after cache is invalidated', async () => {
		const findFn = vi
			.fn()
			.mockResolvedValueOnce({ docs: [makeRule({ name: 'Before' })] })
			.mockResolvedValueOnce({ docs: [makeRule({ name: 'After' })] });
		api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		// Use a long TTL so cache won't expire naturally
		const { app, invalidateCache } = createAppWithInvalidation(() => api, { cacheTtl: 60_000 });

		const res1 = await request(app).get('/analytics/tracking-rules');
		expect(res1.body.rules[0].name).toBe('Before');

		// Invalidate the cache (simulates afterChange/afterDelete hook)
		invalidateCache();

		const res2 = await request(app).get('/analytics/tracking-rules');
		expect(res2.body.rules[0].name).toBe('After');
		// DB was queried twice: once initially, once after invalidation
		expect(findFn).toHaveBeenCalledTimes(2);
	});
});

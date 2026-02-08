import { describe, it, expect, vi } from 'vitest';
import { createApiCollectorMiddleware } from '../collectors/api-collector';
import type { AnalyticsEvent } from '../analytics-event.types';
import type { Request, Response } from 'express';
import { EventEmitter } from 'node:events';

function createMockReq(overrides: Partial<Request> = {}): Request {
	return {
		method: 'GET',
		path: '/api/posts',
		originalUrl: '/api/posts',
		route: { path: '/api/:collection' },
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

describe('createApiCollectorMiddleware', () => {
	it('should call next immediately', () => {
		const emitter = vi.fn();
		const middleware = createApiCollectorMiddleware(emitter);

		const next = vi.fn();
		middleware(createMockReq(), createMockRes(), next);

		expect(next).toHaveBeenCalledOnce();
	});

	it('should emit an api_request event on response finish', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createApiCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq(), res, vi.fn());

		res.emit('finish');

		expect(emitter).toHaveBeenCalledOnce();
		const event = emitter.mock.calls[0][0];
		expect(event.category).toBe('api');
		expect(event.name).toBe('api_request');
		expect(event.context.source).toBe('server');
	});

	it('should capture HTTP method and path', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createApiCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq({ method: 'POST', path: '/api/users' }), res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.properties['method']).toBe('POST');
		expect(event.properties['path']).toBe('/api/users');
	});

	it('should capture response status code', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createApiCollectorMiddleware(emitter);

		const res = createMockRes();
		res.statusCode = 404;
		middleware(createMockReq(), res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.context.statusCode).toBe(404);
	});

	it('should capture request duration', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createApiCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq(), res, vi.fn());

		// Simulate some time passing
		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.context.duration).toBeGreaterThanOrEqual(0);
		expect(typeof event.context.duration).toBe('number');
	});

	it('should capture route path when available', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createApiCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq({ route: { path: '/api/:slug' } as Request['route'] }), res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.properties['route']).toBe('/api/:slug');
	});

	it('should capture user-agent, IP, device, browser, and OS', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createApiCollectorMiddleware(emitter);

		const res = createMockRes();
		middleware(createMockReq(), res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.context.ip).toBe('127.0.0.1');
		expect(event.context.device).toBe('desktop');
		expect(event.context.browser).toBe('Chrome');
		expect(event.context.os).toBe('Windows');
		expect(event.context.url).toBe('/api/posts');
	});

	it('should capture referrer from headers', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createApiCollectorMiddleware(emitter);

		const res = createMockRes();
		const req = createMockReq({
			headers: {
				'user-agent': 'test/1.0',
				referer: 'https://example.com/page',
			},
		} as Partial<Request>);
		middleware(req, res, vi.fn());

		res.emit('finish');

		const event = emitter.mock.calls[0][0];
		expect(event.context.referrer).toBe('https://example.com/page');
	});

	it('should generate unique event IDs', () => {
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();
		const middleware = createApiCollectorMiddleware(emitter);

		const res1 = createMockRes();
		const res2 = createMockRes();
		middleware(createMockReq(), res1, vi.fn());
		middleware(createMockReq(), res2, vi.fn());

		res1.emit('finish');
		res2.emit('finish');

		const id1 = emitter.mock.calls[0][0].id;
		const id2 = emitter.mock.calls[1][0].id;
		expect(id1).not.toBe(id2);
	});
});

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimitMiddleware } from './rate-limit-middleware';
import { RateLimiter } from '@momentumcms/server-core';

describe('createRateLimitMiddleware', () => {
	let app: express.Application;

	beforeEach(() => {
		app = express();
	});

	it('should allow requests under the limit', async () => {
		const limiter = new RateLimiter(5);
		app.use(createRateLimitMiddleware(limiter));
		app.get('/test', (_req, res) => res.json({ ok: true }));

		const res = await request(app).get('/test');
		expect(res.status).toBe(200);
	});

	it('should return 429 when rate limit is exceeded', async () => {
		const limiter = new RateLimiter(3);
		app.use(createRateLimitMiddleware(limiter));
		app.get('/test', (_req, res) => res.json({ ok: true }));

		// First 3 should pass
		for (let i = 0; i < 3; i++) {
			const res = await request(app).get('/test');
			expect(res.status).toBe(200);
		}

		// 4th should be rate limited
		const res = await request(app).get('/test');
		expect(res.status).toBe(429);
		expect(res.body.error).toContain('Too many requests');
	});

	it('should include Retry-After header on 429', async () => {
		const limiter = new RateLimiter(1);
		app.use(createRateLimitMiddleware(limiter));
		app.get('/test', (_req, res) => res.json({ ok: true }));

		await request(app).get('/test'); // exhaust limit
		const res = await request(app).get('/test');

		expect(res.status).toBe(429);
		expect(res.headers['retry-after']).toBeDefined();
	});

	it('should rate limit independently per IP via X-Forwarded-For', async () => {
		const limiter = new RateLimiter(1);
		app.use(createRateLimitMiddleware(limiter));
		app.get('/test', (_req, res) => res.json({ ok: true }));

		// IP-A exhausts its limit
		await request(app).get('/test').set('X-Forwarded-For', '1.1.1.1');
		const blockedRes = await request(app).get('/test').set('X-Forwarded-For', '1.1.1.1');
		expect(blockedRes.status).toBe(429);

		// IP-B should still be allowed (independent limit)
		const allowedRes = await request(app).get('/test').set('X-Forwarded-For', '2.2.2.2');
		expect(allowedRes.status).toBe(200);
	});

	it('should not interfere with other routes when scoped', async () => {
		const limiter = new RateLimiter(1);
		// Only rate limit /limited
		app.use('/limited', createRateLimitMiddleware(limiter));
		app.get('/limited', (_req, res) => res.json({ ok: true }));
		app.get('/free', (_req, res) => res.json({ ok: true }));

		await request(app).get('/limited'); // exhaust limit

		const limitedRes = await request(app).get('/limited');
		expect(limitedRes.status).toBe(429);

		// /free should still work
		const freeRes = await request(app).get('/free');
		expect(freeRes.status).toBe(200);
	});
});

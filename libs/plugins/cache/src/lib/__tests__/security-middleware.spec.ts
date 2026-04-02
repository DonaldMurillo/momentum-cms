/**
 * Security Tests: Cache Middleware
 *
 * Tests for: C1 (API key bypass), M1 (invalidation timeout), M5 (write-after-end)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createCacheMiddleware } from '../cache-middleware';
import { LRUCacheAdapter } from '../adapters/lru-adapter';

describe('Security: Cache Middleware', () => {
	let adapter: LRUCacheAdapter;

	beforeEach(() => {
		adapter = new LRUCacheAdapter({ maxSize: 100 });
	});

	describe('C1: API key auth bypass — X-API-Key requests must skip cache', () => {
		function createApiKeyApp() {
			const app = express();
			app.use(express.json());

			// Simulate session resolver at app level (sets req.user from cookies)
			app.use((req, _res, next) => {
				const authHeader = req.headers['authorization'];
				if (authHeader === 'Bearer admin-token') {
					(req as Record<string, unknown>)['user'] = { id: '1', role: 'admin' };
				}
				// X-API-Key users do NOT get req.user set here — that happens later
				next();
			});

			// Cache middleware goes here (before API key resolver)
			const cacheRouter = createCacheMiddleware(
				adapter,
				{ defaultScope: 'public' },
				new Set(['posts']),
				new Set(),
				new Set(),
				undefined,
			);
			app.use('/api', cacheRouter);

			// Simulate API key resolver (runs AFTER cache middleware in real setup)
			app.use((req, _res, next) => {
				if (req.headers['x-api-key'] === 'admin-key') {
					(req as Record<string, unknown>)['user'] = { id: '99', role: 'admin' };
				}
				next();
			});

			// Downstream handler
			app.get('/api/:collection/:id?', (req, res) => {
				const user = (req as Record<string, unknown>)['user'] as { role?: string } | undefined;
				if (user?.role === 'admin') {
					res.json({ docs: [{ id: '1', title: 'Secret Admin Data' }], totalDocs: 1 });
				} else {
					res.json({ docs: [{ id: '1', title: 'Public Data' }], totalDocs: 1 });
				}
			});

			return app;
		}

		it('should NOT cache responses for X-API-Key requests (preventing cache poisoning)', async () => {
			const app = createApiKeyApp();

			// Request with API key — should bypass cache entirely
			const res1 = await request(app).get('/api/posts').set('X-API-Key', 'admin-key');
			expect(res1.body.docs[0].title).toBe('Secret Admin Data');

			// Subsequent unauthenticated request should NOT get the admin data
			const res2 = await request(app).get('/api/posts');
			expect(res2.body.docs[0].title).toBe('Public Data');
		});

		it('should still cache session-authenticated requests normally', async () => {
			const app = createApiKeyApp();

			// Session-authenticated request — should be cached
			await request(app).get('/api/posts').set('Authorization', 'Bearer admin-token');

			// Same auth — should hit cache
			await request(app).get('/api/posts').set('Authorization', 'Bearer admin-token');

			const stats = await adapter.stats();
			expect(stats.hits).toBe(1);
		});
	});

	describe('M1: Global write invalidation timeout', () => {
		it('should complete the response even if invalidation is slow', async () => {
			const slowInvalidateGlobal = async (_slug: string): Promise<void> => {
				// Simulate very slow invalidation (but not infinite)
				await new Promise((resolve) => setTimeout(resolve, 100));
				await adapter.deleteByTag(`global:${_slug}`);
			};

			const app = express();
			app.use(express.json());

			const cacheRouter = createCacheMiddleware(
				adapter,
				{ defaultScope: 'public' },
				new Set(),
				new Set(['settings']),
				new Set(),
				undefined,
				slowInvalidateGlobal,
			);
			app.use('/api', cacheRouter);

			app.get('/api/globals/:slug', (req, res) => {
				res.json({ doc: { slug: req.params['slug'], value: 'val' } });
			});

			app.put('/api/globals/:slug', (req, res) => {
				res.json({ doc: { slug: req.params['slug'], value: 'updated' } });
			});

			// Populate cache
			await request(app).get('/api/globals/settings');

			// Write should complete without hanging
			const writeRes = await request(app).put('/api/globals/settings').send({ value: 'new' });
			expect(writeRes.status).toBe(200);
		}, 10000);

		it('should not hang if invalidation promise never resolves', async () => {
			const hangingInvalidateGlobal = (_slug: string): Promise<void> => {
				// This promise NEVER resolves
				return new Promise(() => {
					// intentionally empty — simulates a hung Redis connection
				});
			};

			const app = express();
			app.use(express.json());

			const cacheRouter = createCacheMiddleware(
				adapter,
				{ defaultScope: 'public' },
				new Set(),
				new Set(['settings']),
				new Set(),
				undefined,
				hangingInvalidateGlobal,
			);
			app.use('/api', cacheRouter);

			app.get('/api/globals/:slug', (req, res) => {
				res.json({ doc: { slug: req.params['slug'], value: 'val' } });
			});

			app.put('/api/globals/:slug', (_req, res) => {
				res.json({ doc: { value: 'updated' } });
			});

			// Populate cache
			await request(app).get('/api/globals/settings');

			// Write should still complete within timeout, not hang forever
			const writeRes = await request(app).put('/api/globals/settings').send({ value: 'new' });
			expect(writeRes.status).toBe(200);
		}, 15000);
	});
});

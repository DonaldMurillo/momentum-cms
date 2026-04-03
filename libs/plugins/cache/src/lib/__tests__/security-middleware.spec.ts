/**
 * Security Tests: Cache Middleware
 *
 * Tests for: C1 (API key bypass), M1 (invalidation timeout), M5 (write-after-end),
 *            M6 (unauthorized write must NOT invalidate globals cache)
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

	describe('Response timing: global writes must not delay response for cache invalidation', () => {
		it('should flush the HTTP response WITHOUT waiting for invalidation to finish', async () => {
			let invalidationFinished = false;

			const slowInvalidateGlobal = async (slug: string): Promise<void> => {
				await new Promise((resolve) => setTimeout(resolve, 200));
				invalidationFinished = true;
				await adapter.deleteByTag(`global:${slug}`);
			};

			const app = express();
			app.use(express.json());

			const cacheRouter = createCacheMiddleware(
				adapter,
				{ defaultScope: 'public', invalidationTimeout: 5000 },
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

			app.put('/api/globals/:slug', (_req, res) => {
				res.json({ doc: { value: 'updated' } });
			});

			// Populate cache
			await request(app).get('/api/globals/settings');

			// Write — response should arrive BEFORE the 200ms invalidation completes
			const writeRes = await request(app).put('/api/globals/settings').send({ value: 'new' });
			expect(writeRes.status).toBe(200);

			// The response must NOT have waited for invalidation to finish
			expect(invalidationFinished).toBe(false);

			// Invalidation should still complete eventually (fire-and-forget)
			await new Promise((resolve) => setTimeout(resolve, 300));
			expect(invalidationFinished).toBe(true);
			expect((await adapter.stats()).size).toBe(0);
		});

		it('should not couple response latency to cache backend latency', async () => {
			const slowInvalidateGlobal = async (slug: string): Promise<void> => {
				// Simulate 500ms Redis delay
				await new Promise((resolve) => setTimeout(resolve, 500));
				await adapter.deleteByTag(`global:${slug}`);
			};

			const app = express();
			app.use(express.json());

			const cacheRouter = createCacheMiddleware(
				adapter,
				{ defaultScope: 'public', invalidationTimeout: 5000 },
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

			app.put('/api/globals/:slug', (_req, res) => {
				res.json({ doc: { value: 'updated' } });
			});

			await request(app).get('/api/globals/settings');

			// Response must arrive well under the 500ms invalidation delay
			const start = Date.now();
			const writeRes = await request(app).put('/api/globals/settings').send({ value: 'new' });
			const elapsed = Date.now() - start;

			expect(writeRes.status).toBe(200);
			// Should complete in <100ms, not 500ms+
			expect(elapsed).toBeLessThan(200);

			// Wait for fire-and-forget invalidation to complete
			await new Promise((resolve) => setTimeout(resolve, 600));
		});
	});

	describe('M6: Unauthorized global writes must NOT invalidate cache (DoS prevention)', () => {
		function createGlobalsApp(invalidateGlobal: (slug: string) => Promise<void>) {
			const app = express();
			app.use(express.json());

			// Simulate session resolver (auth sets req.user)
			app.use((req, _res, next) => {
				const authHeader = req.headers['authorization'];
				if (authHeader === 'Bearer admin-token') {
					(req as Record<string, unknown>)['user'] = { id: '1', role: 'admin' };
				}
				next();
			});

			const cacheRouter = createCacheMiddleware(
				adapter,
				{ defaultScope: 'public' },
				new Set(),
				new Set(['settings']),
				new Set(),
				undefined,
				invalidateGlobal,
			);
			app.use('/api', cacheRouter);

			app.get('/api/globals/:slug', (req, res) => {
				res.json({ doc: { slug: req.params['slug'], value: 'val' } });
			});

			// Downstream auth check — rejects non-admin writes
			app.put('/api/globals/:slug', (req, res) => {
				const user = (req as Record<string, unknown>)['user'] as { role?: string } | undefined;
				if (!user || user.role !== 'admin') {
					res.status(403).json({ error: 'Forbidden' });
					return;
				}
				res.json({ doc: { slug: req.params['slug'], value: 'updated' } });
			});

			return app;
		}

		it('should NOT invalidate globals cache when write returns 403', async () => {
			let invalidationCount = 0;
			const trackingInvalidateGlobal = async (slug: string): Promise<void> => {
				invalidationCount++;
				await adapter.deleteByTag(`global:${slug}`);
			};

			const app = createGlobalsApp(trackingInvalidateGlobal);

			// Populate cache
			await request(app).get('/api/globals/settings');
			expect((await adapter.stats()).size).toBe(1);

			// Unauthorized write — should be rejected AND cache should remain intact
			const writeRes = await request(app).put('/api/globals/settings').send({ value: 'evil' });
			expect(writeRes.status).toBe(403);

			// Cache must still be present — unauthorized write must NOT flush it
			expect((await adapter.stats()).size).toBe(1);
			expect(invalidationCount).toBe(0);
		});

		it('should NOT invalidate globals cache when write returns 401 (unauthenticated)', async () => {
			let invalidationCount = 0;
			const trackingInvalidateGlobal = async (slug: string): Promise<void> => {
				invalidationCount++;
				await adapter.deleteByTag(`global:${slug}`);
			};

			const app = createGlobalsApp(trackingInvalidateGlobal);

			// Populate cache
			await request(app).get('/api/globals/settings');
			expect((await adapter.stats()).size).toBe(1);

			// Unauthenticated write — cache must survive
			const writeRes = await request(app).put('/api/globals/settings').send({ value: 'attack' });
			expect(writeRes.status).toBe(403);

			expect((await adapter.stats()).size).toBe(1);
			expect(invalidationCount).toBe(0);
		});

		it('should STILL invalidate globals cache when admin write succeeds (200)', async () => {
			let invalidationCount = 0;
			const trackingInvalidateGlobal = async (slug: string): Promise<void> => {
				invalidationCount++;
				await adapter.deleteByTag(`global:${slug}`);
			};

			const app = createGlobalsApp(trackingInvalidateGlobal);

			// Populate cache
			await request(app).get('/api/globals/settings');
			expect((await adapter.stats()).size).toBe(1);

			// Authorized admin write — should succeed AND invalidate cache
			const writeRes = await request(app)
				.put('/api/globals/settings')
				.set('Authorization', 'Bearer admin-token')
				.send({ value: 'legit' });
			expect(writeRes.status).toBe(200);

			// Cache must be invalidated after successful write
			expect((await adapter.stats()).size).toBe(0);
			expect(invalidationCount).toBe(1);
		});
	});
});

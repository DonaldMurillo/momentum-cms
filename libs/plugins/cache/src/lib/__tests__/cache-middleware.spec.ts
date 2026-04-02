import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createCacheMiddleware, createCacheManagementRouter } from '../cache-middleware';
import { LRUCacheAdapter } from '../adapters/lru-adapter';
import type { CachePluginConfig } from '../cache-plugin-config.types';

function createTestApp(
	adapter: LRUCacheAdapter,
	config: CachePluginConfig,
	collectionSlugs: Set<string>,
	globalSlugs = new Set<string>(),
) {
	const app = express();
	app.use(express.json());

	// Simulate auth middleware setting req.user
	app.use((req, _res, next) => {
		const authHeader = req.headers['authorization'];
		if (authHeader === 'Bearer admin-token') {
			(req as Record<string, unknown>)['user'] = {
				id: '1',
				role: 'admin',
				email: 'admin@test.com',
			};
		} else if (authHeader === 'Bearer user-token') {
			(req as Record<string, unknown>)['user'] = {
				id: '2',
				role: 'editor',
				email: 'user@test.com',
			};
		}
		next();
	});

	const invalidateGlobal = async (slug: string): Promise<void> => {
		await adapter.deleteByTag(`global:${slug}`);
	};
	const cacheRouter = createCacheMiddleware(
		adapter,
		config,
		collectionSlugs,
		globalSlugs,
		new Set(config.excludeCollections ?? []),
		undefined,
		invalidateGlobal,
	);
	app.use('/api', cacheRouter);

	// Simulate collection CRUD endpoint that the cache middleware wraps
	app.get('/api/:collection/:id?', (req, res) => {
		const id = req.params['id'];
		if (id) {
			res.json({ doc: { id, title: 'Test Doc' } });
		} else {
			res.json({ docs: [{ id: '1', title: 'Test' }], totalDocs: 1 });
		}
	});

	app.get('/api/globals/:slug', (req, res) => {
		res.json({ doc: { slug: req.params['slug'], value: 'global-val' } });
	});

	app.put('/api/globals/:slug', (req, res) => {
		res.json({ doc: { slug: req.params['slug'], value: 'updated' } });
	});

	return app;
}

describe('createCacheMiddleware', () => {
	let adapter: LRUCacheAdapter;

	beforeEach(() => {
		adapter = new LRUCacheAdapter({ maxSize: 100 });
	});

	it('should cache GET collection responses', async () => {
		const app = createTestApp(adapter, { defaultScope: 'public' }, new Set(['posts']));

		// First request - cache miss
		const res1 = await request(app).get('/api/posts');
		expect(res1.status).toBe(200);
		expect(res1.body.docs).toBeDefined();

		// Second request - cache hit
		const res2 = await request(app).get('/api/posts');
		expect(res2.status).toBe(200);
		expect(res2.body).toEqual(res1.body);

		const stats = await adapter.stats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
	});

	it('should return 304 on matching ETag', async () => {
		const app = createTestApp(adapter, { defaultScope: 'public', etags: true }, new Set(['posts']));

		// First request - populate cache
		const res1 = await request(app).get('/api/posts');
		const etag = res1.headers['etag'] as string;
		expect(etag).toBeTruthy();

		// Second request with If-None-Match
		const res2 = await request(app).get('/api/posts').set('If-None-Match', etag);
		expect(res2.status).toBe(304);
		expect(res2.text).toBe('');
	});

	it('should set Cache-Control header', async () => {
		const app = createTestApp(
			adapter,
			{ defaultScope: 'public', defaultTtl: 120 },
			new Set(['posts']),
		);

		const res = await request(app).get('/api/posts');
		expect(res.headers['cache-control']).toBe('public, max-age=120');
	});

	it('should set private Cache-Control for user scope', async () => {
		const app = createTestApp(
			adapter,
			{ defaultScope: 'user', defaultTtl: 60 },
			new Set(['posts']),
		);

		const res = await request(app).get('/api/posts').set('Authorization', 'Bearer user-token');
		expect(res.headers['cache-control']).toBe('private, max-age=60');
	});

	it('should skip non-collection routes', async () => {
		const app = createTestApp(adapter, {}, new Set(['posts']));

		await request(app).get('/api/unknown');
		const stats = await adapter.stats();
		expect(stats.misses).toBe(0);
	});

	it('should skip excluded collections', async () => {
		const app = createTestApp(adapter, { excludeCollections: ['posts'] }, new Set(['posts']));

		await request(app).get('/api/posts');
		const stats = await adapter.stats();
		expect(stats.misses).toBe(0);
	});

	it('should isolate cache by user scope', async () => {
		const app = createTestApp(adapter, { defaultScope: 'user' }, new Set(['posts']));

		// Two different users
		await request(app).get('/api/posts').set('Authorization', 'Bearer admin-token');
		await request(app).get('/api/posts').set('Authorization', 'Bearer user-token');

		const stats = await adapter.stats();
		expect(stats.misses).toBe(2); // Two separate cache entries
		expect(stats.size).toBe(2);
	});

	it('should cache findById separately from find', async () => {
		const app = createTestApp(adapter, { defaultScope: 'public' }, new Set(['posts']));

		await request(app).get('/api/posts');
		await request(app).get('/api/posts/abc');

		const stats = await adapter.stats();
		expect(stats.misses).toBe(2);
		expect(stats.size).toBe(2);
	});

	it('should include ETag, Cache-Control, and Vary headers on 304 responses', async () => {
		const app = createTestApp(
			adapter,
			{ defaultScope: 'public', etags: true, defaultTtl: 120 },
			new Set(['posts']),
		);

		// First request — populate cache
		const res1 = await request(app).get('/api/posts');
		const etag = res1.headers['etag'] as string;
		expect(etag).toBeTruthy();

		// Second request with If-None-Match — should 304 WITH headers
		const res2 = await request(app).get('/api/posts').set('If-None-Match', etag);
		expect(res2.status).toBe(304);
		expect(res2.headers['etag']).toBe(etag);
		expect(res2.headers['cache-control']).toBe('public, max-age=120');
		expect(res2.headers['vary']).toBeDefined();
	});

	it('should use per-global scope config instead of defaultScope', async () => {
		const app = createTestApp(
			adapter,
			{
				defaultScope: 'user',
				globals: { settings: { scope: 'public' } },
			},
			new Set(),
			new Set(['settings']),
		);

		// Two different authenticated users requesting the same global with scope: 'public'
		// Security: authenticated users are upgraded to role-based isolation, so different
		// roles should produce separate cache entries to prevent cross-privilege pollution.
		await request(app).get('/api/globals/settings').set('Authorization', 'Bearer admin-token');
		await request(app).get('/api/globals/settings').set('Authorization', 'Bearer user-token');

		const stats = await adapter.stats();
		// admin → role:admin, editor → role:editor → 2 separate entries
		expect(stats.misses).toBe(2);
		expect(stats.hits).toBe(0);
		expect(stats.size).toBe(2);
	});

	it('should isolate authenticated users from unauthenticated in public scope', async () => {
		const app = createTestApp(adapter, { defaultScope: 'public' }, new Set(['posts']));

		// Unauthenticated request — gets 'pub' scope
		await request(app).get('/api/posts');

		// Authenticated admin request — must get 'role:admin' scope, NOT 'pub'
		await request(app).get('/api/posts').set('Authorization', 'Bearer admin-token');

		const stats = await adapter.stats();
		// Security: these must be separate cache entries to prevent admin data
		// leaking to unauthenticated users
		expect(stats.misses).toBe(2);
		expect(stats.size).toBe(2);
	});

	it('should invalidate globals cache AFTER the write handler completes (not before)', async () => {
		const callOrder: string[] = [];

		const customInvalidateGlobal = async (slug: string): Promise<void> => {
			callOrder.push('invalidate:' + slug);
			await adapter.deleteByTag(`global:${slug}`);
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
			customInvalidateGlobal,
		);
		app.use('/api', cacheRouter);

		app.get('/api/globals/:slug', (req, res) => {
			res.json({ doc: { slug: req.params['slug'], value: 'val' } });
		});

		app.put('/api/globals/:slug', (req, res) => {
			callOrder.push('write-handler');
			res.json({ doc: { slug: req.params['slug'], value: 'updated' } });
		});

		// Populate cache
		await request(app).get('/api/globals/settings');
		let stats = await adapter.stats();
		expect(stats.size).toBe(1);

		// Write — invalidation must happen AFTER write handler responds
		await request(app).put('/api/globals/settings').send({ value: 'new' });

		// The write handler must execute BEFORE invalidation (post-write, not pre-write)
		expect(callOrder).toEqual(['write-handler', 'invalidate:settings']);

		// Cache must be empty after write
		stats = await adapter.stats();
		expect(stats.size).toBe(0);
	});

	it('should serve fresh data after global write', async () => {
		let globalValue = 'original';

		const app = express();
		app.use(express.json());

		const customInvalidateGlobal = async (slug: string): Promise<void> => {
			await adapter.deleteByTag(`global:${slug}`);
		};

		const cacheRouter = createCacheMiddleware(
			adapter,
			{ defaultScope: 'public' },
			new Set(),
			new Set(['settings']),
			new Set(),
			undefined,
			customInvalidateGlobal,
		);
		app.use('/api', cacheRouter);

		app.get('/api/globals/:slug', (_req, res) => {
			res.json({ doc: { value: globalValue } });
		});

		app.put('/api/globals/:slug', (req, res) => {
			globalValue = (req.body as Record<string, unknown>)['value'] as string;
			res.json({ doc: { value: globalValue } });
		});

		// Populate cache
		const res1 = await request(app).get('/api/globals/settings');
		expect(res1.body.doc.value).toBe('original');

		// Write new data
		await request(app).put('/api/globals/settings').send({ value: 'updated' });

		// Read should get fresh data
		const res2 = await request(app).get('/api/globals/settings');
		expect(res2.body.doc.value).toBe('updated');
	});

	it('should ignore unknown query params in cache key to prevent cache thrashing', async () => {
		const app = createTestApp(adapter, { defaultScope: 'public' }, new Set(['posts']));

		// Request with known CMS param
		await request(app).get('/api/posts?limit=10');

		// Request with same known param + arbitrary junk — should be a cache HIT
		// because junk params are filtered out of the cache key
		await request(app).get('/api/posts?limit=10&junk=random');

		const stats = await adapter.stats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
	});

	it('should respect custom allowedQueryParams config', async () => {
		const app = createTestApp(
			adapter,
			{ defaultScope: 'public', allowedQueryParams: ['limit', 'custom'] },
			new Set(['posts']),
		);

		// Two requests differing only in unknown param
		await request(app).get('/api/posts?limit=10&custom=a');
		await request(app).get('/api/posts?limit=10&custom=a&ignored=123');

		const stats = await adapter.stats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
	});

	it('should complete global invalidation before the write response is received (Bug #1)', async () => {
		let invalidationComplete = false;

		const customInvalidateGlobal = async (slug: string): Promise<void> => {
			await new Promise((resolve) => setTimeout(resolve, 50));
			invalidationComplete = true;
			await adapter.deleteByTag(`global:${slug}`);
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
			customInvalidateGlobal,
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
		expect((await adapter.stats()).size).toBe(1);

		// Write — by the time the response arrives, invalidation must be done
		await request(app).put('/api/globals/settings').send({ value: 'new' });

		expect(invalidationComplete).toBe(true);
		expect((await adapter.stats()).size).toBe(0);
	});

	it('should invalidate global cache when handler uses res.send() (Bug #2)', async () => {
		const customInvalidateGlobal = async (slug: string): Promise<void> => {
			await adapter.deleteByTag(`global:${slug}`);
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
			customInvalidateGlobal,
		);
		app.use('/api', cacheRouter);

		app.get('/api/globals/:slug', (req, res) => {
			res.json({ doc: { slug: req.params['slug'], value: 'val' } });
		});

		// Handler uses res.send() instead of res.json()
		app.put('/api/globals/:slug', (_req, res) => {
			res.send('ok');
		});

		// Populate cache
		await request(app).get('/api/globals/settings');
		expect((await adapter.stats()).size).toBe(1);

		// Write with res.send()
		await request(app).put('/api/globals/settings').send({ value: 'new' });

		// Cache must still be invalidated
		expect((await adapter.stats()).size).toBe(0);
	});

	it('should invalidate global cache when handler uses res.status(204).end() (Bug #2)', async () => {
		const customInvalidateGlobal = async (slug: string): Promise<void> => {
			await adapter.deleteByTag(`global:${slug}`);
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
			customInvalidateGlobal,
		);
		app.use('/api', cacheRouter);

		app.get('/api/globals/:slug', (req, res) => {
			res.json({ doc: { slug: req.params['slug'], value: 'val' } });
		});

		// Handler uses res.status(204).end() — no body, no json()
		app.put('/api/globals/:slug', (_req, res) => {
			res.status(204).end();
		});

		// Populate cache
		await request(app).get('/api/globals/settings');
		expect((await adapter.stats()).size).toBe(1);

		// Write with res.status(204).end()
		await request(app).put('/api/globals/settings');

		// Cache must still be invalidated
		expect((await adapter.stats()).size).toBe(0);
	});

	it('should not cache error responses', async () => {
		const app = express();
		app.use(express.json());

		const cacheRouter = createCacheMiddleware(
			adapter,
			{ defaultScope: 'public' },
			new Set(['posts']),
			new Set(),
			new Set(),
			undefined,
		);
		app.use('/api', cacheRouter);
		app.get('/api/:collection', (_req, res) => {
			res.status(404).json({ error: 'Not found' });
		});

		await request(app).get('/api/posts');
		const stats = await adapter.stats();
		expect(stats.size).toBe(0);
	});
});

describe('createCacheManagementRouter', () => {
	let adapter: LRUCacheAdapter;

	beforeEach(() => {
		adapter = new LRUCacheAdapter({ maxSize: 100 });
	});

	function createMgmtApp() {
		const app = express();
		app.use(express.json());
		app.use((req, _res, next) => {
			const authHeader = req.headers['authorization'];
			if (authHeader === 'Bearer admin') {
				(req as Record<string, unknown>)['user'] = { id: '1', role: 'admin' };
			} else if (authHeader === 'Bearer user') {
				(req as Record<string, unknown>)['user'] = { id: '2', role: 'editor' };
			}
			next();
		});
		app.use('/cache', createCacheManagementRouter(adapter));
		return app;
	}

	it('should return stats for admin users', async () => {
		const app = createMgmtApp();
		const res = await request(app).get('/cache/stats').set('Authorization', 'Bearer admin');
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('size');
		expect(res.body).toHaveProperty('hits');
	});

	it('should reject stats for non-admin users', async () => {
		const app = createMgmtApp();
		const res = await request(app).get('/cache/stats').set('Authorization', 'Bearer user');
		expect(res.status).toBe(403);
	});

	it('should reject stats for unauthenticated users', async () => {
		const app = createMgmtApp();
		const res = await request(app).get('/cache/stats');
		expect(res.status).toBe(403);
	});

	it('should purge all cache for admin', async () => {
		await adapter.set('k1', {
			value: 'v1',
			tags: ['t'],
			createdAt: Date.now(),
			ttl: 60,
		});

		const app = createMgmtApp();
		const res = await request(app)
			.post('/cache/purge')
			.set('Authorization', 'Bearer admin')
			.send({});
		expect(res.status).toBe(200);
		expect(res.body.purged).toBe('all');

		const stats = await adapter.stats();
		expect(stats.size).toBe(0);
	});

	it('should purge by tag for admin', async () => {
		await adapter.set('k1', {
			value: 'v1',
			tags: ['posts'],
			createdAt: Date.now(),
			ttl: 60,
		});
		await adapter.set('k2', {
			value: 'v2',
			tags: ['users'],
			createdAt: Date.now(),
			ttl: 60,
		});

		const app = createMgmtApp();
		const res = await request(app)
			.post('/cache/purge')
			.set('Authorization', 'Bearer admin')
			.send({ tag: 'posts' });
		expect(res.status).toBe(200);
		expect(res.body.purged).toBe(1);
		expect(res.body.tag).toBe('posts');

		expect(await adapter.get('k2')).toBeDefined();
	});
});

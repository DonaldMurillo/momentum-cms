import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MomentumModule } from './momentum.module';
import { SessionMiddleware } from './guards/session.middleware';
import { API_KEY_STORE } from './momentum-config.token';
import {
	resetMomentumAPI,
	createInMemoryAdapter,
	hashApiKey,
	type ApiKeyStore,
} from '@momentumcms/server-core';
import type { MomentumConfig, CollectionConfig } from '@momentumcms/core';

const mockCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text', required: true }],
};

function createTestConfig(): MomentumConfig {
	return {
		collections: [mockCollection],
		db: { adapter: createInMemoryAdapter() },
		server: { port: 4000 },
	} as MomentumConfig;
}

describe('MomentumModule', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();
	});

	afterEach(async () => {
		if (app) await app.close();
		resetMomentumAPI();
	});

	it('forRoot() should create a dynamic module with all controllers wired', async () => {
		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(createTestConfig())],
		}).compile();

		app = module.createNestApplication();
		await app.init();

		// Health endpoint should work
		const healthRes = await request(app.getHttpServer()).get('/health');
		expect(healthRes.status).toBe(200);
		expect(healthRes.body.status).toBe('ok');

		// Collection CRUD should work
		const listRes = await request(app.getHttpServer()).get('/posts');
		expect(listRes.status).toBe(200);
		expect(listRes.body.docs).toEqual([]);

		// Access endpoint should work
		const accessRes = await request(app.getHttpServer()).get('/access');
		expect(accessRes.status).toBe(200);
		expect(accessRes.body.collections).toBeDefined();
	});

	it('forRoot() should apply exception filter for 404 errors', async () => {
		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(createTestConfig())],
		}).compile();

		app = module.createNestApplication();
		await app.init();

		const res = await request(app.getHttpServer()).get('/nonexistent');
		expect(res.status).toBe(404);
	});

	it('forRoot() should apply response interceptor for custom status codes', async () => {
		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(createTestConfig())],
		}).compile();

		app = module.createNestApplication();
		await app.init();

		const res = await request(app.getHttpServer()).post('/posts').send({ title: 'Hello' });
		expect(res.status).toBe(201);
	});

	it('should register SessionMiddleware in the DI container', async () => {
		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(createTestConfig())],
		}).compile();

		app = module.createNestApplication();
		await app.init();

		const sessionMiddleware = app.get(SessionMiddleware);
		expect(sessionMiddleware).toBeDefined();
		expect(typeof sessionMiddleware.setSessionResolver).toBe('function');
	});

	it('should pass through requests when no API key store is configured', async () => {
		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(createTestConfig())],
		}).compile();

		app = module.createNestApplication();
		await app.init();

		// No API_KEY_STORE provided — guard should pass through
		const res = await request(app.getHttpServer()).get('/posts');
		expect(res.status).toBe(200);
	});

	it('should reject requests with invalid API key when store is configured', async () => {
		const mockStore: ApiKeyStore = {
			create: async () => 'id',
			findByHash: async () => null,
			listAll: async () => [],
			listByUser: async () => [],
			findById: async () => null,
			revoke: async () => undefined,
			updateLastUsed: async () => undefined,
		};

		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(createTestConfig())],
		})
			.overrideProvider(API_KEY_STORE)
			.useValue(mockStore)
			.compile();

		app = module.createNestApplication();
		await app.init();

		const res = await request(app.getHttpServer())
			.get('/posts')
			.set('x-api-key', 'mcms_' + 'b'.repeat(40));
		expect(res.status).toBe(401);
	});

	it('should allow requests with valid API key when store is configured', async () => {
		const testKey = 'mcms_' + 'a'.repeat(40);
		const keyHash = hashApiKey(testKey);

		const mockStore: ApiKeyStore = {
			create: async () => 'id',
			findByHash: async (hash: string) => {
				if (hash === keyHash) {
					return {
						id: 'key-1',
						keyHash: hash,
						name: 'Test Key',
						role: 'admin',
						createdBy: 'user-1',
						createdAt: new Date().toISOString(),
					};
				}
				return null;
			},
			listAll: async () => [],
			listByUser: async () => [],
			findById: async () => null,
			revoke: async () => undefined,
			updateLastUsed: async () => undefined,
		};

		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(createTestConfig())],
		})
			.overrideProvider(API_KEY_STORE)
			.useValue(mockStore)
			.compile();

		app = module.createNestApplication();
		await app.init();

		const res = await request(app.getHttpServer()).get('/posts').set('x-api-key', testKey);
		expect(res.status).toBe(200);
	});
});

import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'vitest';
import { createMomentumNestServer } from './create-momentum-nest-server';
import { SessionMiddleware } from './guards/session.middleware';
import { resetMomentumAPI, createInMemoryAdapter } from '@momentumcms/server-core';
import type { MomentumConfig, CollectionConfig } from '@momentumcms/core';
import request from 'supertest';

const mockCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text', required: true }],
};

function createTestConfig(): MomentumConfig {
	return {
		collections: [mockCollection],
		db: { adapter: createInMemoryAdapter() },
		server: { port: 0 },
	} as MomentumConfig;
}

describe('createMomentumNestServer', () => {
	let shutdown: (() => Promise<void>) | undefined;

	afterEach(async () => {
		if (shutdown) await shutdown();
		resetMomentumAPI();
	});

	it('should create a NestJS server with working API', async () => {
		const server = await createMomentumNestServer({ config: createTestConfig() });
		shutdown = server.shutdown;

		const httpServer = server.app.getHttpAdapter().getInstance();
		const res = await request(httpServer).get('/api/posts');
		expect(res.status).toBe(200);
		expect(res.body.docs).toEqual([]);
	});

	it('should mount health endpoint at /api/health', async () => {
		const server = await createMomentumNestServer({ config: createTestConfig() });
		shutdown = server.shutdown;

		const httpServer = server.app.getHttpAdapter().getInstance();
		const res = await request(httpServer).get('/api/health');
		expect(res.status).toBe(200);
		expect(res.body.status).toBe('ok');
	});

	it('should support CRUD operations', async () => {
		const server = await createMomentumNestServer({ config: createTestConfig() });
		shutdown = server.shutdown;

		const httpServer = server.app.getHttpAdapter().getInstance();

		const createRes = await request(httpServer).post('/api/posts').send({ title: 'Test Post' });
		expect(createRes.status).toBe(201);
		expect(createRes.body.doc.title).toBe('Test Post');

		const id = createRes.body.doc.id;
		const getRes = await request(httpServer).get(`/api/posts/${id}`);
		expect(getRes.status).toBe(200);
		expect(getRes.body.doc.title).toBe('Test Post');
	});

	it('should expose SessionMiddleware from the DI container', async () => {
		const server = await createMomentumNestServer({ config: createTestConfig() });
		shutdown = server.shutdown;

		const sessionMiddleware = server.app.get(SessionMiddleware);
		expect(sessionMiddleware).toBeDefined();
		expect(typeof sessionMiddleware.setSessionResolver).toBe('function');
	});
});

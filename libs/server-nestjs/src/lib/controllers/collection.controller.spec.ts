import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CollectionController } from './collection.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { MomentumExceptionFilter } from '../filters/momentum-exception.filter';
import { MomentumResponseInterceptor } from '../interceptors/momentum-response.interceptor';
import { resetMomentumAPI, createInMemoryAdapter } from '@momentumcms/server-core';
import type { MomentumConfig, CollectionConfig } from '@momentumcms/core';

const mockCollection: CollectionConfig = {
	slug: 'posts',
	fields: [
		{ name: 'title', type: 'text', required: true },
		{ name: 'body', type: 'textarea' },
	],
};

function createTestConfig(): MomentumConfig {
	return {
		collections: [mockCollection],
		db: { adapter: createInMemoryAdapter() },
		server: { port: 4000 },
	} as MomentumConfig;
}

describe('CollectionController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();

		const module = await Test.createTestingModule({
			controllers: [CollectionController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: createTestConfig() }],
		}).compile();

		app = module.createNestApplication();
		app.useGlobalFilters(new MomentumExceptionFilter());
		app.useGlobalInterceptors(new MomentumResponseInterceptor());
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('GET /:collection should return empty docs array', async () => {
		const res = await request(app.getHttpServer()).get('/posts');
		expect(res.status).toBe(200);
		expect(res.body.docs).toEqual([]);
		expect(res.body.totalDocs).toBe(0);
	});

	it('GET /:collection should return 404 for unknown collection', async () => {
		const res = await request(app.getHttpServer()).get('/nonexistent');
		expect(res.status).toBe(404);
	});

	it('POST /:collection should create document and return 201', async () => {
		const res = await request(app.getHttpServer()).post('/posts').send({ title: 'Hello World' });
		expect(res.status).toBe(201);
		expect(res.body.doc).toBeDefined();
		expect(res.body.doc.title).toBe('Hello World');
	});

	it('GET /:collection should return created documents', async () => {
		await request(app.getHttpServer()).post('/posts').send({ title: 'Post 1' });
		await request(app.getHttpServer()).post('/posts').send({ title: 'Post 2' });

		const res = await request(app.getHttpServer()).get('/posts');
		expect(res.status).toBe(200);
		expect(res.body.docs).toHaveLength(2);
		expect(res.body.totalDocs).toBe(2);
	});

	it('GET /:collection/:id should return document by id', async () => {
		const createRes = await request(app.getHttpServer()).post('/posts').send({ title: 'My Post' });
		const id = createRes.body.doc.id;

		const res = await request(app.getHttpServer()).get(`/posts/${id}`);
		expect(res.status).toBe(200);
		expect(res.body.doc.title).toBe('My Post');
	});

	it('GET /:collection/:id should return 404 for nonexistent document', async () => {
		const res = await request(app.getHttpServer()).get('/posts/nonexistent-id');
		expect(res.status).toBe(404);
	});

	it('PATCH /:collection/:id should update document', async () => {
		const createRes = await request(app.getHttpServer()).post('/posts').send({ title: 'Original' });
		const id = createRes.body.doc.id;

		const res = await request(app.getHttpServer()).patch(`/posts/${id}`).send({ title: 'Updated' });
		expect(res.status).toBe(200);
		expect(res.body.doc.title).toBe('Updated');
	});

	it('DELETE /:collection/:id should delete document', async () => {
		const createRes = await request(app.getHttpServer())
			.post('/posts')
			.send({ title: 'To Delete' });
		const id = createRes.body.doc.id;

		const res = await request(app.getHttpServer()).delete(`/posts/${id}`);
		expect(res.status).toBe(200);
		expect(res.body.deleted).toBe(true);
		expect(res.body.id).toBe(id);

		// Verify the document is actually gone
		const verifyRes = await request(app.getHttpServer()).get(`/posts/${id}`);
		expect(verifyRes.status).toBe(404);
	});

	it('GET /:collection should accept where query param as JSON without error', async () => {
		await request(app.getHttpServer()).post('/posts').send({ title: 'Alpha' });
		await request(app.getHttpServer()).post('/posts').send({ title: 'Beta' });

		// The where param must be parsed as JSON (not dropped or cause a crash)
		const where = JSON.stringify({ title: { equals: 'Alpha' } });
		const res = await request(app.getHttpServer()).get(`/posts?where=${encodeURIComponent(where)}`);
		expect(res.status).toBe(200);
		// In-memory adapter doesn't filter, but the request must not crash
		expect(res.body.docs).toBeDefined();
		expect(Array.isArray(res.body.docs)).toBe(true);
	});

	it('GET /:collection should accept withDeleted query param', async () => {
		const res = await request(app.getHttpServer()).get('/posts?withDeleted=true');
		expect(res.status).toBe(200);
		expect(res.body.docs).toBeDefined();
	});

	it('GET /:collection should accept limit and page query params', async () => {
		await request(app.getHttpServer()).post('/posts').send({ title: 'Post 1' });
		await request(app.getHttpServer()).post('/posts').send({ title: 'Post 2' });
		await request(app.getHttpServer()).post('/posts').send({ title: 'Post 3' });

		const res = await request(app.getHttpServer()).get('/posts?limit=2&page=1');
		expect(res.status).toBe(200);
		expect(res.body.docs).toBeDefined();
	});
});

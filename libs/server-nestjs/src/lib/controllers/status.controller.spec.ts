import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { StatusController } from './status.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import {
	resetMomentumAPI,
	initializeMomentumAPI,
	createInMemoryAdapter,
	getMomentumAPI,
} from '@momentumcms/server-core';
import type { MomentumConfig, CollectionConfig } from '@momentumcms/core';

const versionedCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text' }],
	versions: { drafts: true },
};

const unversionedCollection: CollectionConfig = {
	slug: 'tags',
	fields: [{ name: 'name', type: 'text' }],
};

function createTestConfig(collections: CollectionConfig[]): MomentumConfig {
	return {
		collections,
		db: { adapter: createInMemoryAdapter() },
	} as MomentumConfig;
}

describe('StatusController', () => {
	let app: INestApplication;
	let config: MomentumConfig;

	beforeEach(async () => {
		resetMomentumAPI();
		config = createTestConfig([versionedCollection, unversionedCollection]);
		initializeMomentumAPI(config);

		const module = await Test.createTestingModule({
			controllers: [StatusController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('returns 400 when versioning is not enabled on the collection', async () => {
		const res = await request(app.getHttpServer()).get('/tags/1/status');
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Versioning not enabled');
	});

	it('returns 404 when the document does not exist', async () => {
		const res = await request(app.getHttpServer()).get('/posts/nonexistent/status');
		expect(res.status).toBe(404);
		expect(res.body.error).toBe('Document not found');
	});

	it('returns 200 with status payload for an existing versioned document', async () => {
		const created = await getMomentumAPI()
			.collection<{ title: string }>('posts')
			.create({ title: 'Hi' });

		const res = await request(app.getHttpServer()).get(`/posts/${created['id']}/status`);
		expect(res.status).toBe(200);
		expect(typeof res.body.status).toBe('string');
		expect(['draft', 'published']).toContain(res.body.status);
	});
});

describe('StatusController access control', () => {
	let app: INestApplication;
	let docId: string;

	const restrictedCollection: CollectionConfig = {
		slug: 'restricted',
		fields: [{ name: 'data', type: 'text' }],
		versions: { drafts: true },
		access: {
			// Allow admin to seed
			read: ({ req }) => req.user?.role === 'admin',
			// Deny readVersions for everyone in this test (anonymous request from supertest)
			readVersions: ({ req }) => req.user?.role === 'admin',
		},
	};

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([restrictedCollection]);
		initializeMomentumAPI(config);

		// Seed a doc as admin so the access-denied test has a real id to fetch
		const created = await getMomentumAPI()
			.setContext({ user: { id: 'admin', role: 'admin' } })
			.collection<{ data: string }>('restricted')
			.create({ data: 'classified' });
		docId = String(created['id']);

		const module = await Test.createTestingModule({
			controllers: [StatusController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('returns 403 when the anonymous request is denied readVersions access', async () => {
		// Supertest sends no auth header → req.user is undefined → readVersions
		// access function receives `{ req: { user: undefined } }` → returns false
		// → AccessDeniedError → 403 via handleStatusRequest's mapping.
		const res = await request(app.getHttpServer()).get(`/restricted/${docId}/status`);
		expect(res.status).toBe(403);
		expect(res.body.error).toBe('Access denied');
	});
});

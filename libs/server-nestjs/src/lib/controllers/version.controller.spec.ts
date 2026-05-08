import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { VersionController } from './version.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI, getMomentumAPI } from '@momentumcms/server-core';
import type { CollectionConfig } from '@momentumcms/core';
import {
	createTestConfig,
	versionedCollection,
	unversionedCollection,
} from '../__test-utils__/fixtures';

describe('VersionController', () => {
	let app: INestApplication;
	let docId: string;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([versionedCollection, unversionedCollection]);
		initializeMomentumAPI(config);

		const created = await getMomentumAPI()
			.collection<{ title: string }>('posts')
			.create({ title: 'Hello' });
		docId = String(created['id']);

		const module = await Test.createTestingModule({
			controllers: [VersionController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('GET /:collection/:id/versions returns 400 when versioning is not enabled', async () => {
		const res = await request(app.getHttpServer()).get('/tags/anything/versions');
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Versioning not enabled');
	});

	it('POST /:collection/:id/versions/restore returns 400 without versionId', async () => {
		const res = await request(app.getHttpServer())
			.post(`/posts/${docId}/versions/restore`)
			.send({});
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Invalid request');
	});

	it('POST /:collection/:id/versions/compare returns 400 without both ids', async () => {
		const res = await request(app.getHttpServer())
			.post(`/posts/${docId}/versions/compare`)
			.send({ versionId1: 'a' });
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Missing version IDs');
	});

	// Route-discrimination tests: each @Get/@Post must dispatch to its own
	// handler. The in-memory adapter cannot satisfy version operations, so
	// these intentionally trip the 500 error mapper — which carries a label
	// unique to each handler. Swapping a route to the wrong handler would
	// flip the label and fail the assertion.
	it('GET /:collection/:id/versions dispatches to handleListVersionsRequest', async () => {
		const res = await request(app.getHttpServer()).get(`/posts/${docId}/versions`);
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to fetch versions');
	});

	it('GET /:collection/:id/versions/:versionId dispatches to handleGetVersionRequest', async () => {
		const res = await request(app.getHttpServer()).get(`/posts/${docId}/versions/v-unknown`);
		// The handler may return 404 (version not found) or 500 (adapter throws).
		// Either way, the body identifies the right handler.
		expect([404, 500]).toContain(res.status);
		expect(res.body.error).toMatch(/Version not found|Failed to fetch version/);
	});

	it('POST /:collection/:id/versions/restore dispatches to handleRestoreVersionRequest', async () => {
		const res = await request(app.getHttpServer())
			.post(`/posts/${docId}/versions/restore`)
			.send({ versionId: 'v-unknown' });
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to restore version');
	});

	it('POST /:collection/:id/versions/compare dispatches to handleCompareVersionsRequest', async () => {
		const res = await request(app.getHttpServer())
			.post(`/posts/${docId}/versions/compare`)
			.send({ versionId1: 'a', versionId2: 'b' });
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to compare versions');
	});
});

describe('VersionController access control', () => {
	let app: INestApplication;
	let docId: string;

	const restrictedCollection: CollectionConfig = {
		slug: 'restricted',
		fields: [{ name: 'data', type: 'text' }],
		versions: { drafts: true },
		access: {
			read: ({ req }) => req.user?.role === 'admin',
			readVersions: ({ req }) => req.user?.role === 'admin',
		},
	};

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([restrictedCollection]);
		initializeMomentumAPI(config);

		const created = await getMomentumAPI()
			.setContext({ user: { id: 'admin', role: 'admin' } })
			.collection<{ data: string }>('restricted')
			.create({ data: 'classified' });
		docId = String(created['id']);

		const module = await Test.createTestingModule({
			controllers: [VersionController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('returns 403 when anonymous request is denied readVersions access', async () => {
		const res = await request(app.getHttpServer()).get(`/restricted/${docId}/versions`);
		expect(res.status).toBe(403);
		expect(res.body.error).toBe('Access denied');
	});
});

import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublishingController } from './publishing.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI, getMomentumAPI } from '@momentumcms/server-core';
import {
	createTestConfig,
	versionedCollection,
	unversionedCollection,
} from '../__test-utils__/fixtures';

describe('PublishingController', () => {
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
			controllers: [PublishingController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('POST /:collection/:id/publish returns 400 when versioning is not enabled', async () => {
		const res = await request(app.getHttpServer()).post('/tags/anything/publish');
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Versioning not enabled');
	});

	it('POST /:collection/:id/schedule-publish returns 400 without publishAt', async () => {
		const res = await request(app.getHttpServer())
			.post(`/posts/${docId}/schedule-publish`)
			.send({});
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Missing publishAt');
	});

	// Route-discrimination tests: each @Post must dispatch to its own handler.
	// The in-memory adapter cannot satisfy publishing operations, so these
	// intentionally trip the 500 error mapper — which carries a label unique
	// to each handler. Swapping a route to the wrong handler would flip the
	// label and fail the assertion.
	it('POST /:collection/:id/publish dispatches to handlePublishRequest', async () => {
		const res = await request(app.getHttpServer()).post(`/posts/${docId}/publish`);
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to publish document');
	});

	it('POST /:collection/:id/unpublish dispatches to handleUnpublishRequest', async () => {
		const res = await request(app.getHttpServer()).post(`/posts/${docId}/unpublish`);
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to unpublish document');
	});

	it('POST /:collection/:id/draft dispatches to handleSaveDraftRequest', async () => {
		const res = await request(app.getHttpServer())
			.post(`/posts/${docId}/draft`)
			.send({ title: 'updated' });
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to save draft');
	});

	it('POST /:collection/:id/schedule-publish dispatches to handleSchedulePublishRequest', async () => {
		const future = new Date(Date.now() + 60_000).toISOString();
		const res = await request(app.getHttpServer())
			.post(`/posts/${docId}/schedule-publish`)
			.send({ publishAt: future });
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to schedule publish');
	});

	it('POST /:collection/:id/cancel-scheduled-publish dispatches to handleCancelScheduledPublishRequest', async () => {
		const res = await request(app.getHttpServer()).post(`/posts/${docId}/cancel-scheduled-publish`);
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Failed to cancel scheduled publish');
	});
});

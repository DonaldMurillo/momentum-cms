import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PreviewController } from './preview.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI, getMomentumAPI } from '@momentumcms/server-core';
import { createTestConfig, unversionedCollection } from '../__test-utils__/fixtures';

describe('PreviewController', () => {
	let app: INestApplication;
	let docId: string;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([unversionedCollection]);
		initializeMomentumAPI(config);

		const created = await getMomentumAPI()
			.collection<{ name: string }>('tags')
			.create({ name: 'angular' });
		docId = String(created['id']);

		const module = await Test.createTestingModule({
			controllers: [PreviewController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('GET /:collection/:id/preview returns 401 with the preview-handler error envelope', async () => {
		const res = await request(app.getHttpServer()).get(`/tags/${docId}/preview`);
		expect(res.status).toBe(401);
		// Pin the response to `handlePreviewRequest` in preview-handler.ts —
		// any other 401 source (e.g., a guard short-circuiting before the
		// controller) would not produce this exact message.
		expect(res.body.error).toBe('Authentication required to access preview');
	});

	it('POST /:collection/:id/preview returns 401 with the preview-handler error envelope', async () => {
		const res = await request(app.getHttpServer()).post(`/tags/${docId}/preview`).send({});
		expect(res.status).toBe(401);
		expect(res.body.error).toBe('Authentication required to access preview');
	});
});

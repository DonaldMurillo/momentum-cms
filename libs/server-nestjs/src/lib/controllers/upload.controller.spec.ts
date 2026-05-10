import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UploadController } from './upload.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI } from '@momentumcms/server-core';
import type { CollectionConfig } from '@momentumcms/core';
import { createTestConfig } from '../__test-utils__/fixtures';

const uploadCollection: CollectionConfig = {
	slug: 'media',
	fields: [{ name: 'alt', type: 'text' }],
	upload: true,
};

const nonUploadCollection: CollectionConfig = {
	slug: 'tags',
	fields: [{ name: 'name', type: 'text' }],
};

describe('UploadController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([uploadCollection, nonUploadCollection]);
		initializeMomentumAPI(config);

		const module = await Test.createTestingModule({
			controllers: [UploadController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('POST /:collection/upload returns 400 when collection is not an upload collection', async () => {
		const res = await request(app.getHttpServer()).post('/tags/upload').send({});
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Not an upload collection');
	});

	it('POST /:collection/upload returns 500 when storage is not configured (upload collection, no file)', async () => {
		const res = await request(app.getHttpServer()).post('/media/upload').send({});
		// uploadCollection is true but no storage adapter configured → 500
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Storage not configured');
	});
});

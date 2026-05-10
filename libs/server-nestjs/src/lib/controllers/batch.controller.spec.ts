import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BatchController } from './batch.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI } from '@momentumcms/server-core';
import { createTestConfig, unversionedCollection } from '../__test-utils__/fixtures';

describe('BatchController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([unversionedCollection]);
		initializeMomentumAPI(config);

		const module = await Test.createTestingModule({
			controllers: [BatchController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('POST /:collection/batch surfaces a 5xx when the collection does not exist', async () => {
		// handleBatchRequest dispatches via getMomentumAPI().collection(slug) which
		// throws CollectionNotFoundError outside the handler's try/catch — NestJS
		// catches it and emits a default 5xx envelope. We only assert the route
		// reached the handler (no 404 swallowing the request before dispatch).
		const res = await request(app.getHttpServer())
			.post('/missing/batch')
			.send({ operation: 'create', items: [{ name: 'a' }] });
		expect(res.status).toBe(500);
	});

	it('POST /:collection/batch returns 400 with "Invalid operation" label for unknown op', async () => {
		const res = await request(app.getHttpServer())
			.post('/tags/batch')
			.send({ operation: 'wat', items: [] });
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Invalid operation');
	});

	it('POST /:collection/batch creates documents for valid create operation', async () => {
		const res = await request(app.getHttpServer())
			.post('/tags/batch')
			.send({ operation: 'create', items: [{ name: 'one' }, { name: 'two' }] });
		expect(res.status).toBe(201);
		expect(Array.isArray(res.body.docs)).toBe(true);
		expect(res.body.docs).toHaveLength(2);
	});
});

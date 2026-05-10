import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CustomEndpointsController } from './custom-endpoints.controller';
import { CollectionController } from './collection.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI, getMomentumAPI } from '@momentumcms/server-core';
import type { CollectionConfig } from '@momentumcms/core';
import { createTestConfig } from '../__test-utils__/fixtures';

const widgets: CollectionConfig = {
	slug: 'widgets',
	fields: [{ name: 'name', type: 'text' }],
	endpoints: [
		{
			method: 'post',
			path: 'echo',
			handler: async ({ body }) => ({ status: 200, body: { ok: true, echoed: body ?? null } }),
		},
	],
};

describe('CustomEndpointsController + CollectionController coexistence', () => {
	let app: INestApplication;
	let docId: string;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([widgets]);
		initializeMomentumAPI(config);

		const created = await getMomentumAPI()
			.collection<{ name: string }>('widgets')
			.create({ name: 'first' });
		docId = String(created['id']);

		const module = await Test.createTestingModule({
			// Order intentional: CustomEndpointsController is listed BEFORE
			// CollectionController to prove fall-through works regardless of order.
			controllers: [CustomEndpointsController, CollectionController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('routes /:collection/:id (real id) to CollectionController findById, not CustomEndpoints', async () => {
		const res = await request(app.getHttpServer()).get(`/widgets/${docId}`);
		expect(res.status).toBe(200);
		// CollectionController.findById returns `{ doc }` envelope from MomentumResponse
		expect(res.body.doc?.name).toBe('first');
	});

	it('still dispatches custom endpoint when the action matches', async () => {
		const res = await request(app.getHttpServer())
			.post('/widgets/echo')
			.send({ greeting: 'hello' });
		expect(res.status).toBe(200);
		expect(res.body.ok).toBe(true);
	});

	it('falls through to CollectionController findById when no endpoint matches the action', async () => {
		const res = await request(app.getHttpServer()).get('/widgets/no-such-doc');
		// CustomEndpointsController has no `get` endpoint registered, so the
		// dispatcher calls next() — CollectionController.findById then runs and
		// surfaces a DocumentNotFoundError envelope. CollectionController returns
		// the MomentumResponse as the JSON body without setting an HTTP status
		// code, so HTTP stays 200 but `body.status` is 404. Asserting BOTH the
		// envelope's status field and the dispatcher-error fingerprint pins this
		// to CRUD's path rather than the dispatcher's catch block (which would
		// emit `{ error: 'Custom endpoint error' }`).
		expect(res.body.status).toBe(404);
		expect(res.body.error).toMatch(/not found/i);
		expect(res.body.error).not.toMatch(/Custom endpoint error/);
	});
});

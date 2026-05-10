import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CustomEndpointsController } from './custom-endpoints.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI, getMomentumAPI } from '@momentumcms/server-core';
import type { CollectionConfig } from '@momentumcms/core';
import { createTestConfig } from '../__test-utils__/fixtures';

const echoCollection: CollectionConfig = {
	slug: 'widgets',
	fields: [{ name: 'name', type: 'text' }],
	endpoints: [
		{
			method: 'post',
			path: 'echo',
			handler: async ({ body }) => ({ status: 200, body: { ok: true, echoed: body ?? null } }),
		},
		{
			method: 'get',
			path: ':id/info',
			handler: async ({ params }) => ({ status: 200, body: { id: params?.['id'] } }),
		},
		{
			method: 'post',
			path: 'boom',
			handler: async () => {
				// Throw an SQL-shaped message so sanitizeErrorMessage's pattern guards trigger.
				// If the controller leaks the raw message, the assertion below catches it.
				throw new Error('SELECT password FROM users WHERE id = 1');
			},
		},
	],
};

describe('CustomEndpointsController', () => {
	let app: INestApplication;
	let docId: string;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([echoCollection]);
		initializeMomentumAPI(config);

		const created = await getMomentumAPI()
			.collection<{ name: string }>('widgets')
			.create({ name: 'first' });
		docId = String(created['id']);

		const module = await Test.createTestingModule({
			controllers: [CustomEndpointsController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('dispatches POST /:collection/:action to the matching endpoint handler', async () => {
		const res = await request(app.getHttpServer())
			.post('/widgets/echo')
			.send({ greeting: 'hello' });
		expect(res.status).toBe(200);
		expect(res.body.ok).toBe(true);
		expect(res.body.echoed).toEqual({ greeting: 'hello' });
	});

	it('dispatches GET /:collection/:id/:action and forwards the id param', async () => {
		const res = await request(app.getHttpServer()).get(`/widgets/${docId}/info`);
		expect(res.status).toBe(200);
		expect(res.body.id).toBe(docId);
	});

	it('falls through to NestJS default 404 when no endpoint matches the action (no next controller registered)', async () => {
		// With only `CustomEndpointsController` registered, an unmatched action
		// reaches the dispatcher's `next()` call (`custom-endpoints.controller.ts`)
		// and Nest's default exception filter emits its canonical 404 envelope:
		// `{ statusCode: 404, message: "Cannot POST ...", error: "Not Found" }`.
		// All three fields together pin this to the framework's final-handler —
		// the `error: "Not Found"` literal in particular is produced only by
		// Nest's built-in `NotFoundException`, never by anything in our adapter.
		const res = await request(app.getHttpServer()).post('/widgets/unknown-action').send({});
		expect(res.status).toBe(404);
		expect(res.body.statusCode).toBe(404);
		expect(res.body.message).toMatch(/Cannot POST/);
		expect(res.body.error).toBe('Not Found');
	});

	it('falls through to NestJS default 404 when the collection does not exist', async () => {
		const res = await request(app.getHttpServer()).post('/missing/echo').send({});
		expect(res.status).toBe(404);
		expect(res.body.statusCode).toBe(404);
		expect(res.body.message).toMatch(/Cannot POST/);
	});

	it('returns 500 with a sanitized fallback when handler throws an SQL-shaped error', async () => {
		const res = await request(app.getHttpServer()).post('/widgets/boom').send({});
		expect(res.status).toBe(500);
		// `sanitizeErrorMessage` swaps SQL-pattern messages for the fallback
		// label "Custom endpoint error" — strict equality is the strongest
		// possible negative leak check (no SELECT/password substring can
		// survive once the body equals a constant). Asserting both error
		// sources surface the fallback proves the dispatcher's catch block
		// is the only path producing the body, not a stray sanitizer leak.
		expect(res.body.error).toBe('Custom endpoint error');
		expect(res.body).toEqual({ error: 'Custom endpoint error' });
	});
});

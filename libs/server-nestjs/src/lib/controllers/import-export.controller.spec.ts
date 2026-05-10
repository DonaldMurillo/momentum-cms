import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ImportExportController } from './import-export.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI, getMomentumAPI } from '@momentumcms/server-core';
import type { CollectionConfig } from '@momentumcms/core';
import { createTestConfig, unversionedCollection } from '../__test-utils__/fixtures';

const managedCollection: CollectionConfig = {
	slug: 'admins',
	fields: [{ name: 'email', type: 'email' }],
	managed: true,
};

describe('ImportExportController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([unversionedCollection, managedCollection]);
		initializeMomentumAPI(config);

		await getMomentumAPI().collection<{ name: string }>('tags').create({ name: 'angular' });

		const module = await Test.createTestingModule({
			controllers: [ImportExportController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('GET /:collection/export returns 401 with the export-handler error envelope', async () => {
		const res = await request(app.getHttpServer()).get('/tags/export');
		expect(res.status).toBe(401);
		// Pin to `handleExportRequest` (import-export-handler.ts) — exact
		// match rules out any unrelated 401 source.
		expect(res.body.error).toBe('Authentication required to export data');
	});

	it('POST /:collection/import returns 403 for managed collections', async () => {
		const res = await request(app.getHttpServer())
			.post('/admins/import')
			.send({ format: 'json', items: [] });
		expect(res.status).toBe(403);
		expect(res.body.error).toBe('Managed collection is read-only');
	});

	it('POST /:collection/import returns 401 with the import-handler error envelope (non-managed)', async () => {
		const res = await request(app.getHttpServer())
			.post('/tags/import')
			.send({ format: 'json', items: [{ name: 'beta' }] });
		expect(res.status).toBe(401);
		expect(res.body.error).toBe('Authentication required to import data');
	});
});

describe('ImportExportController (authenticated happy paths)', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([unversionedCollection]);
		initializeMomentumAPI(config);

		await getMomentumAPI()
			.setContext({ user: { id: 'admin-1', role: 'admin' } })
			.collection<{ name: string }>('tags')
			.create({ name: 'angular' });

		const module = await Test.createTestingModule({
			controllers: [ImportExportController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		// Inject an authenticated user before the controller runs. `extractUser`
		// reads `req.user`; this mirrors what `SessionMiddleware` / `ApiKeyGuard`
		// do in production without pulling them into the test.
		app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
			req.user = { id: 'admin-1', role: 'admin' };
			next();
		});
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('GET /:collection/export returns the seeded docs as JSON for an authenticated user', async () => {
		const res = await request(app.getHttpServer()).get('/tags/export');
		expect(res.status).toBe(200);
		const body = res.body as { docs: { name: string }[] };
		expect(Array.isArray(body.docs)).toBe(true);
		expect(body.docs.some((d) => d.name === 'angular')).toBe(true);
	});

	it('GET /:collection/export?format=csv streams the CSV body with text/csv headers', async () => {
		const res = await request(app.getHttpServer()).get('/tags/export?format=csv');
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toMatch(/text\/csv/);
		// CSV body must include the header row + the seeded "angular" value.
		expect(res.text).toContain('name');
		expect(res.text).toContain('angular');
	});
});

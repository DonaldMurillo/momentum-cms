import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { GlobalsController } from './globals.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { MomentumExceptionFilter } from '../filters/momentum-exception.filter';
import { resetMomentumAPI, createInMemoryAdapter } from '@momentumcms/server-core';
import type { MomentumConfig, GlobalConfig } from '@momentumcms/core';

const mockGlobal: GlobalConfig = {
	slug: 'settings',
	fields: [
		{ name: 'siteTitle', type: 'text' },
		{ name: 'description', type: 'textarea' },
	],
};

function createGlobalsAdapter() {
	const base = createInMemoryAdapter();
	const globals = new Map<string, Record<string, unknown>>();
	return {
		...base,
		async initializeGlobals() {
			/* noop */
		},
		async findGlobal(slug: string) {
			return globals.get(slug) ?? {};
		},
		async updateGlobal(slug: string, data: Record<string, unknown>) {
			const existing = globals.get(slug) ?? {};
			const updated = { ...existing, ...data };
			globals.set(slug, updated);
			return updated;
		},
	};
}

function createTestConfig(): MomentumConfig {
	return {
		collections: [],
		globals: [mockGlobal],
		db: { adapter: createGlobalsAdapter() },
		server: { port: 4000 },
	} as MomentumConfig;
}

describe('GlobalsController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();

		const module = await Test.createTestingModule({
			controllers: [GlobalsController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: createTestConfig() }],
		}).compile();

		app = module.createNestApplication();
		app.useGlobalFilters(new MomentumExceptionFilter());
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('GET /globals/:slug should return global document', async () => {
		const res = await request(app.getHttpServer()).get('/globals/settings');
		expect(res.status).toBe(200);
		expect(res.body.doc).toBeDefined();
	});

	it('PATCH /globals/:slug should update global document', async () => {
		const res = await request(app.getHttpServer())
			.patch('/globals/settings')
			.send({ siteTitle: 'My Site' });
		expect(res.status).toBe(200);
		expect(res.body.doc.siteTitle).toBe('My Site');
	});

	it('should return 404 for unknown global', async () => {
		const res = await request(app.getHttpServer()).get('/globals/nonexistent');
		expect(res.status).toBe(404);
	});
});

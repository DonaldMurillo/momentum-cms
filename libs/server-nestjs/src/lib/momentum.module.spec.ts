import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { MomentumModule } from './momentum.module';
import { MomentumApiService } from './momentum-api.service';
import { MOMENTUM_CONFIG } from './momentum-config.token';
import { resetMomentumAPI, createInMemoryAdapter } from '@momentumcms/server-core';
import type { MomentumConfig, CollectionConfig } from '@momentumcms/core';

const mockCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text', required: true }],
};

function createTestConfig(): MomentumConfig {
	return {
		collections: [mockCollection],
		db: { adapter: createInMemoryAdapter() },
		server: { port: 4000 },
	} as MomentumConfig;
}

describe('MomentumModule', () => {
	let app: INestApplication;

	afterEach(async () => {
		if (app) await app.close();
		resetMomentumAPI();
	});

	it('forRoot() should provide MOMENTUM_CONFIG', async () => {
		const config = createTestConfig();
		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(config)],
		}).compile();

		app = module.createNestApplication();
		await app.init();

		const providedConfig = app.get(MOMENTUM_CONFIG);
		expect(providedConfig).toBe(config);
	});

	it('forRoot() should provide MomentumApiService', async () => {
		const module = await Test.createTestingModule({
			imports: [MomentumModule.forRoot(createTestConfig())],
		}).compile();

		app = module.createNestApplication();
		await app.init();

		const apiService = app.get(MomentumApiService);
		expect(apiService).toBeDefined();
	});
});

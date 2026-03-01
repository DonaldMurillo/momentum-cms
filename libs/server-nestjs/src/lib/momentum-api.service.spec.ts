import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
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

describe('MomentumApiService', () => {
	let service: MomentumApiService;

	beforeEach(async () => {
		resetMomentumAPI();

		const module = await Test.createTestingModule({
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: createTestConfig() }],
		}).compile();

		service = module.get(MomentumApiService);
	});

	afterEach(() => {
		resetMomentumAPI();
	});

	it('should create handlers from config', () => {
		const handlers = service.getHandlers();
		expect(handlers).toBeDefined();
		expect(typeof handlers.handleFind).toBe('function');
		expect(typeof handlers.handleCreate).toBe('function');
		expect(typeof handlers.handleUpdate).toBe('function');
		expect(typeof handlers.handleDelete).toBe('function');
		expect(typeof handlers.routeRequest).toBe('function');
	});

	it('should return MomentumAPI via getApi()', () => {
		const api = service.getApi();
		expect(api).toBeDefined();
		expect(typeof api.collection).toBe('function');
		expect(typeof api.global).toBe('function');
		expect(typeof api.setContext).toBe('function');
	});

	it('should return the config', () => {
		const config = service.getConfig();
		expect(config).toBeDefined();
		expect(config.collections).toHaveLength(1);
		expect(config.collections[0].slug).toBe('posts');
	});

	it('should create contextual API with user', () => {
		const user = { id: 'user-1', email: 'admin@test.com', role: 'admin' };
		const contextualApi = service.getContextualApi(user);
		expect(contextualApi).toBeDefined();
		const ctx = contextualApi.getContext();
		expect(ctx.user).toEqual(user);
	});

	it('should return base API when no user provided', () => {
		const api = service.getContextualApi();
		expect(api).toBeDefined();
		const ctx = api.getContext();
		expect(ctx.user).toBeUndefined();
	});
});

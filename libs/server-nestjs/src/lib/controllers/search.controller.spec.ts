import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SearchController } from './search.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import {
	resetMomentumAPI,
	initializeMomentumAPI,
	getMomentumAPI,
	createInMemoryAdapter,
} from '@momentumcms/server-core';
import type { DatabaseAdapter, MomentumConfig } from '@momentumcms/core';
import { createTestConfig, unversionedCollection } from '../__test-utils__/fixtures';

describe('SearchController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([unversionedCollection]);
		initializeMomentumAPI(config);

		await getMomentumAPI().collection<{ name: string }>('tags').create({ name: 'angular' });
		await getMomentumAPI().collection<{ name: string }>('tags').create({ name: 'nestjs' });

		const module = await Test.createTestingModule({
			controllers: [SearchController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('GET /:collection/search returns search shape with empty query', async () => {
		const res = await request(app.getHttpServer()).get('/tags/search?q=');
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.docs)).toBe(true);
		expect(typeof res.body.totalDocs).toBe('number');
	});

	it('GET /:collection/search forwards limit and page query params', async () => {
		const res = await request(app.getHttpServer()).get('/tags/search?q=&limit=5&page=2');
		expect(res.status).toBe(200);
		expect(res.body.limit).toBe(5);
		expect(res.body.page).toBe(2);
	});
});

describe('SearchController (q forwarding)', () => {
	// The default in-memory adapter ignores filter args, so to prove the
	// controller actually forwards `q` and `fields` we wire a thin spy adapter
	// whose `search()` records the arguments it received and only returns
	// docs whose `name` matches the query — establishing real plumbing
	// end-to-end without a database.
	let app: INestApplication;
	let recorded: { q: string; fields?: string[]; limit?: number; page?: number } | null = null;

	beforeEach(async () => {
		recorded = null;
		resetMomentumAPI();

		const base = createInMemoryAdapter();
		const adapter: DatabaseAdapter = {
			...base,
			async search(slug, query, fields, opts) {
				recorded = {
					q: query,
					fields,
					limit: opts?.limit,
					page: opts?.page,
				};
				const all = await base.find(slug, {});
				const needle = query.toLowerCase();
				return needle
					? all.filter((doc) =>
							String(doc['name'] ?? '')
								.toLowerCase()
								.includes(needle),
						)
					: all;
			},
		};

		const config: MomentumConfig = {
			collections: [unversionedCollection],
			db: { adapter },
		};
		initializeMomentumAPI(config);
		await getMomentumAPI().collection<{ name: string }>('tags').create({ name: 'angular' });
		await getMomentumAPI().collection<{ name: string }>('tags').create({ name: 'nestjs' });

		const module = await Test.createTestingModule({
			controllers: [SearchController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();
		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('forwards q and fields to adapter.search and returns only matching docs', async () => {
		const res = await request(app.getHttpServer()).get('/tags/search?q=angular&fields=name');
		expect(res.status).toBe(200);
		// Spy proves q reached the adapter — controller is not silently dropping it.
		expect(recorded?.q).toBe('angular');
		expect(recorded?.fields).toEqual(['name']);
		const docs = res.body.docs as { name: string }[];
		expect(docs.some((d) => d.name === 'angular')).toBe(true);
		expect(docs.some((d) => d.name === 'nestjs')).toBe(false);
	});
});

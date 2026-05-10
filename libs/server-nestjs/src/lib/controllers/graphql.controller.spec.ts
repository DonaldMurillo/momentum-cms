import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { GraphQLController } from './graphql.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI } from '@momentumcms/server-core';
import { createTestConfig, unversionedCollection } from '../__test-utils__/fixtures';

describe('GraphQLController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([unversionedCollection]);
		initializeMomentumAPI(config);

		const module = await Test.createTestingModule({
			controllers: [GraphQLController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('POST /graphql returns 400 when query is missing', async () => {
		const res = await request(app.getHttpServer()).post('/graphql').send({});
		expect(res.status).toBe(400);
		expect(res.body.errors[0].message).toBe('Query is required');
	});

	it('GET /graphql returns 400 when query parameter is missing', async () => {
		const res = await request(app.getHttpServer()).get('/graphql');
		expect(res.status).toBe(400);
		expect(res.body.errors[0].message).toBe('Query parameter required');
	});

	it('GET /graphql rejects mutations (read-only)', async () => {
		const mutation = encodeURIComponent('mutation { createTags(data: { name: "x" }) { id } }');
		const res = await request(app.getHttpServer()).get(`/graphql?query=${mutation}`);
		expect(res.status).toBe(405);
		expect(res.body.errors[0].message).toMatch(/Mutations are not allowed/);
	});

	it('POST /graphql executes a valid introspection query', async () => {
		const res = await request(app.getHttpServer())
			.post('/graphql')
			.send({ query: '{ __typename }' });
		expect(res.status).toBe(200);
		expect(res.body.data.__typename).toBe('Query');
	});

	it('POST /graphql forwards variables to the handler', async () => {
		// Use $name in an introspection query that actually consumes it. If the
		// controller drops the `variables` field on the way to
		// handleGraphQLPostRequest, graphql-js will reject the operation with a
		// "Variable ... was not provided" error.
		const provided = await request(app.getHttpServer())
			.post('/graphql')
			.send({
				query: 'query ($name: String!) { __type(name: $name) { name } }',
				variables: { name: 'String' },
			});
		expect(provided.status).toBe(200);
		expect(provided.body.errors).toBeUndefined();
		expect(provided.body.data.__type.name).toBe('String');

		const missing = await request(app.getHttpServer()).post('/graphql').send({
			query: 'query ($name: String!) { __type(name: $name) { name } }',
		});
		expect(missing.status).toBe(200);
		expect(missing.body.errors).toBeDefined();
		expect(missing.body.errors[0].message).toMatch(/Variable.*name.*was not provided/i);
	});
});

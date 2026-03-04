import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		const module = await Test.createTestingModule({
			controllers: [HealthController],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
	});

	it('GET /health should return ok status', async () => {
		const res = await request(app.getHttpServer()).get('/health');
		expect(res.status).toBe(200);
		expect(res.body.status).toBe('ok');
		expect(res.body.ready).toBe(true);
		expect(res.body.timestamp).toBeDefined();
	});
});

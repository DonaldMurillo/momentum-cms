import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { CollectionConfig } from '@momentumcms/core';
import { WORKFLOW_ERROR_CODES } from '@momentumcms/core';
import { getMomentumAPI, initializeMomentumAPI, resetMomentumAPI } from '@momentumcms/server-core';
import { WorkflowController } from './workflow.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { createTestConfig, unversionedCollection } from '../__test-utils__/fixtures';

const articlesCollection: CollectionConfig = {
	slug: 'articles',
	fields: [{ name: 'title', type: 'text' }],
	access: { read: () => true, update: () => true, create: () => true, delete: () => true },
	workflow: {
		stages: [
			{ id: 'draft', label: 'Draft', transitions: ['in-review'] },
			{ id: 'in-review', label: 'In Review', transitions: ['draft', 'approved'] },
			{ id: 'approved', label: 'Approved', transitions: ['draft'], publishesOnEnter: true },
		],
		initialStage: 'draft',
	},
};

describe('WorkflowController', () => {
	let app: INestApplication;
	let docId: string;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([articlesCollection, unversionedCollection]);
		initializeMomentumAPI(config);

		const created = await getMomentumAPI().collection('articles').create({
			title: 'Hello',
			workflowStage: 'draft',
			workflowUpdatedAt: new Date().toISOString(),
		});
		docId = String(created['id']);

		const module = await Test.createTestingModule({
			controllers: [WorkflowController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('POST /:collection/:id/transition returns 400 when workflow is not configured', async () => {
		const res = await request(app.getHttpServer())
			.post('/tags/anything/transition')
			.send({ toStage: 'in-review' });
		expect(res.status).toBe(400);
		expect(res.body.code).toBe(WORKFLOW_ERROR_CODES.WorkflowNotConfigured);
	});

	it('POST /:collection/:id/transition succeeds for declared transition', async () => {
		const res = await request(app.getHttpServer())
			.post(`/articles/${docId}/transition`)
			.send({ toStage: 'in-review', comment: 'review please' });
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			id: docId,
			fromStage: 'draft',
			toStage: 'in-review',
		});
	});

	it('POST /:collection/:id/transition rejects undeclared transition', async () => {
		const res = await request(app.getHttpServer())
			.post(`/articles/${docId}/transition`)
			.send({ toStage: 'approved' });
		expect(res.status).toBe(400);
		expect(res.body.code).toBe(WORKFLOW_ERROR_CODES.InvalidTransition);
	});

	it('GET /:collection/:id/workflow-history returns history after a transition', async () => {
		await request(app.getHttpServer())
			.post(`/articles/${docId}/transition`)
			.send({ toStage: 'in-review' });

		const res = await request(app.getHttpServer()).get(`/articles/${docId}/workflow-history`);
		expect(res.status).toBe(200);
		// 2 rows: creation (null→draft) and the explicit draft→in-review transition.
		expect(res.body.totalDocs).toBe(2);
		expect(res.body.docs[0]).toMatchObject({ fromStage: 'draft', toStage: 'in-review' });
		expect(res.body.docs[1]).toMatchObject({ fromStage: null, toStage: 'draft' });
	});

	it('GET /:collection/:id/workflow-history returns 400 when workflow is not configured', async () => {
		const res = await request(app.getHttpServer()).get('/tags/anything/workflow-history');
		expect(res.status).toBe(400);
		expect(res.body.code).toBe(WORKFLOW_ERROR_CODES.WorkflowNotConfigured);
	});
});

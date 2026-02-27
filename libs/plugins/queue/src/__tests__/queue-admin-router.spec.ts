import { createQueueAdminRouter } from '../lib/queue-admin-router';
import type { QueueAdapter, Job } from '@momentumcms/core';
import express from 'express';
import request from 'supertest';

function createMockAdapter(): QueueAdapter {
	return {
		initialize: vi.fn(async () => undefined),
		enqueue: vi.fn(async () => ({}) as Job),
		fetchJobs: vi.fn(async () => []),
		completeJob: vi.fn(async () => undefined),
		failJob: vi.fn(async () => undefined),
		queryJobs: vi.fn(async () => ({ jobs: [], total: 0, page: 1, limit: 50 })),
		getStats: vi.fn(async () => []),
		getJob: vi.fn(async () => null),
		deleteJob: vi.fn(async () => true),
		purgeJobs: vi.fn(async () => 0),
		retryJob: vi.fn(async () => ({}) as Job),
		recoverStalledJobs: vi.fn(async () => 0),
		shutdown: vi.fn(async () => undefined),
	};
}

function createMockJob(overrides: Partial<Job> = {}): Job {
	return {
		id: 'job-1',
		type: 'test:job',
		payload: {},
		status: 'pending',
		queue: 'default',
		priority: 5,
		attempts: 0,
		maxRetries: 3,
		backoff: { type: 'exponential', delay: 1000 },
		timeout: 30000,
		runAt: null,
		createdAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		...overrides,
	};
}

/** Create an express app with admin user injected (authenticated). */
function createAdminApp(adapter: QueueAdapter): express.Express {
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => {
		Object.assign(_req, { user: { id: 'admin-1', role: 'admin' } });
		next();
	});
	app.use('/queue', createQueueAdminRouter(adapter));
	return app;
}

/** Create an express app with no user (unauthenticated). */
function createUnauthenticatedApp(adapter: QueueAdapter): express.Express {
	const app = express();
	app.use(express.json());
	app.use('/queue', createQueueAdminRouter(adapter));
	return app;
}

/** Create an express app with a non-admin user. */
function createNonAdminApp(adapter: QueueAdapter): express.Express {
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => {
		Object.assign(_req, { user: { id: 'user-1', role: 'editor' } });
		next();
	});
	app.use('/queue', createQueueAdminRouter(adapter));
	return app;
}

describe('queue admin router', () => {
	// ──────────────────────────────────────────
	// Bug #2: GET /jobs/:id must use getJob
	// ──────────────────────────────────────────

	describe('GET /jobs/:id', () => {
		it('should return the job when getJob finds it', async () => {
			const adapter = createMockAdapter();
			const job = createMockJob({ id: 'specific-id', type: 'email:send' });
			(adapter.getJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce(job);

			const res = await request(createAdminApp(adapter)).get('/queue/jobs/specific-id');

			expect(res.status).toBe(200);
			expect(res.body.job.id).toBe('specific-id');
			expect(res.body.job.type).toBe('email:send');
			expect(adapter.getJob).toHaveBeenCalledWith('specific-id');
		});

		it('should return 404 when getJob returns null', async () => {
			const adapter = createMockAdapter();
			(adapter.getJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

			const res = await request(createAdminApp(adapter)).get('/queue/jobs/nonexistent');

			expect(res.status).toBe(404);
			expect(res.body.error).toBe('Job not found');
		});

		it('should call getJob instead of queryJobs', async () => {
			const adapter = createMockAdapter();

			await request(createAdminApp(adapter)).get('/queue/jobs/some-id');

			expect(adapter.getJob).toHaveBeenCalledWith('some-id');
			expect(adapter.queryJobs).not.toHaveBeenCalled();
		});
	});

	// ──────────────────────────────────────────
	// Bug #1: Authentication enforcement
	// ──────────────────────────────────────────

	describe('authentication', () => {
		it('should return 401 for unauthenticated GET /stats', async () => {
			const adapter = createMockAdapter();
			const res = await request(createUnauthenticatedApp(adapter)).get('/queue/stats');
			expect(res.status).toBe(401);
			expect(res.body.error).toBe('Authentication required');
		});

		it('should return 401 for unauthenticated GET /jobs', async () => {
			const adapter = createMockAdapter();
			const res = await request(createUnauthenticatedApp(adapter)).get('/queue/jobs');
			expect(res.status).toBe(401);
		});

		it('should return 401 for unauthenticated GET /jobs/:id', async () => {
			const adapter = createMockAdapter();
			const res = await request(createUnauthenticatedApp(adapter)).get('/queue/jobs/abc');
			expect(res.status).toBe(401);
		});

		it('should return 401 for unauthenticated POST /jobs/:id/retry', async () => {
			const adapter = createMockAdapter();
			const res = await request(createUnauthenticatedApp(adapter)).post('/queue/jobs/abc/retry');
			expect(res.status).toBe(401);
		});

		it('should return 401 for unauthenticated DELETE /jobs/:id', async () => {
			const adapter = createMockAdapter();
			const res = await request(createUnauthenticatedApp(adapter)).delete('/queue/jobs/abc');
			expect(res.status).toBe(401);
		});

		it('should return 401 for unauthenticated POST /purge', async () => {
			const adapter = createMockAdapter();
			const res = await request(createUnauthenticatedApp(adapter)).post('/queue/purge');
			expect(res.status).toBe(401);
		});

		it('should return 403 for non-admin user on GET /stats', async () => {
			const adapter = createMockAdapter();
			const res = await request(createNonAdminApp(adapter)).get('/queue/stats');
			expect(res.status).toBe(403);
			expect(res.body.error).toBe('Admin access required');
		});

		it('should allow admin user on GET /stats', async () => {
			const adapter = createMockAdapter();
			(adapter.getStats as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

			const res = await request(createAdminApp(adapter)).get('/queue/stats');

			expect(res.status).toBe(200);
		});
	});

	// ──────────────────────────────────────────
	// Bug #3: Internal error messages must not leak
	// ──────────────────────────────────────────

	describe('error message sanitization', () => {
		it('GET /stats should not leak internal PostgreSQL error details', async () => {
			const adapter = createMockAdapter();
			(adapter.getStats as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error('relation "momentum_queue_jobs" does not exist'),
			);

			const res = await request(createAdminApp(adapter)).get('/queue/stats');

			expect(res.status).toBe(500);
			expect(res.body.error).not.toContain('momentum_queue_jobs');
			expect(res.body.error).not.toContain('relation');
			expect(res.body.error).toBe('Internal server error');
		});

		it('GET /jobs should not leak internal error details', async () => {
			const adapter = createMockAdapter();
			(adapter.queryJobs as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error('column "payload" of relation "queue_jobs" violates not-null constraint'),
			);

			const res = await request(createAdminApp(adapter)).get('/queue/jobs');

			expect(res.status).toBe(500);
			expect(res.body.error).toBe('Internal server error');
		});

		it('POST /jobs/:id/retry should return generic error on failure', async () => {
			const adapter = createMockAdapter();
			(adapter.retryJob as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error('duplicate key value violates unique constraint "queue_jobs_pkey"'),
			);

			const res = await request(createAdminApp(adapter)).post('/queue/jobs/abc/retry');

			expect(res.status).toBe(400);
			expect(res.body.error).toBe('Failed to retry job');
			expect(res.body.error).not.toContain('duplicate key');
			expect(res.body.error).not.toContain('queue_jobs_pkey');
		});

		it('POST /purge should not leak internal error details', async () => {
			const adapter = createMockAdapter();
			(adapter.purgeJobs as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error('connection to server at "10.0.0.5" refused'),
			);

			const res = await request(createAdminApp(adapter)).post('/queue/purge');

			expect(res.status).toBe(500);
			expect(res.body.error).toBe('Internal server error');
		});

		it('DELETE /jobs/:id should not leak internal error details', async () => {
			const adapter = createMockAdapter();
			(adapter.deleteJob as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error('statement timeout'),
			);

			const res = await request(createAdminApp(adapter)).delete('/queue/jobs/abc');

			expect(res.status).toBe(500);
			expect(res.body.error).toBe('Internal server error');
		});
	});
});

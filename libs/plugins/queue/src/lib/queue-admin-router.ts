/**
 * Express router for queue admin API endpoints.
 * Provides job monitoring, management, and queue statistics.
 * All endpoints require admin authentication.
 */

import type { QueueAdapter, JobStatus } from '@momentumcms/core';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAdmin } from './queue-auth';

const JOB_STATUS_SET = new Set(['pending', 'active', 'completed', 'failed', 'dead']);

function isJobStatus(val: unknown): val is JobStatus {
	return typeof val === 'string' && JOB_STATUS_SET.has(val);
}

function toOptionalString(val: unknown): string | undefined {
	return typeof val === 'string' ? val : undefined;
}

function toOptionalInt(val: unknown): number | undefined {
	if (typeof val === 'string') {
		const parsed = parseInt(val, 10);
		return isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function isRecord(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function toNumber(val: unknown, fallback: number): number {
	return typeof val === 'number' ? val : fallback;
}

function toPurgeStatus(val: unknown): 'completed' | 'dead' {
	return val === 'dead' ? 'dead' : 'completed';
}

export interface QueueAdminRouterOptions {
	adapter: QueueAdapter;
	logger?: { error: (msg: string) => void };
}

/**
 * Create an Express Router with queue admin API endpoints.
 */
export function createQueueAdminRouter(
	adapterOrOptions: QueueAdapter | QueueAdminRouterOptions,
): Router {
	const adapter = 'adapter' in adapterOrOptions ? adapterOrOptions.adapter : adapterOrOptions;
	const logger = 'adapter' in adapterOrOptions ? adapterOrOptions.logger : undefined;
	const router = Router();

	function handleError(
		res: Response,
		err: unknown,
		status = 500,
		fallback = 'Internal server error',
	): void {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		if (logger) logger.error(msg);
		res.status(status).json({ error: fallback });
	}

	// GET /api/queue/stats — Queue statistics
	router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
		try {
			const queue = toOptionalString(req.query['queue']);
			const stats = await adapter.getStats(queue);
			res.json({ stats });
		} catch (err: unknown) {
			handleError(res, err);
		}
	});

	// GET /api/queue/jobs — List/filter jobs
	router.get('/jobs', requireAdmin, async (req: Request, res: Response) => {
		try {
			const statusVal = toOptionalString(req.query['status']);
			const result = await adapter.queryJobs({
				status: isJobStatus(statusVal) ? statusVal : undefined,
				queue: toOptionalString(req.query['queue']),
				type: toOptionalString(req.query['type']),
				limit: toOptionalInt(req.query['limit']),
				page: toOptionalInt(req.query['page']),
			});
			res.json(result);
		} catch (err: unknown) {
			handleError(res, err);
		}
	});

	// GET /api/queue/jobs/:id — Job detail
	router.get('/jobs/:id', requireAdmin, async (req: Request, res: Response) => {
		try {
			const job = await adapter.getJob(req.params['id'] ?? '');
			if (!job) {
				res.status(404).json({ error: 'Job not found' });
				return;
			}
			res.json({ job });
		} catch (err: unknown) {
			handleError(res, err);
		}
	});

	// POST /api/queue/jobs/:id/retry — Retry a dead job
	router.post('/jobs/:id/retry', requireAdmin, async (req: Request, res: Response) => {
		try {
			const jobId = req.params['id'] ?? '';
			const job = await adapter.retryJob(jobId);
			res.json({ job });
		} catch (err: unknown) {
			handleError(res, err, 400, 'Failed to retry job');
		}
	});

	// DELETE /api/queue/jobs/:id — Delete a job
	router.delete('/jobs/:id', requireAdmin, async (req: Request, res: Response) => {
		try {
			const jobId = req.params['id'] ?? '';
			const deleted = await adapter.deleteJob(jobId);
			res.json({ deleted });
		} catch (err: unknown) {
			handleError(res, err);
		}
	});

	// POST /api/queue/purge — Purge old jobs
	router.post('/purge', requireAdmin, async (req: Request, res: Response) => {
		try {
			const body = isRecord(req.body) ? req.body : {};
			const olderThanMs = toNumber(body['olderThanMs'], 7 * 24 * 60 * 60 * 1000);
			const status = toPurgeStatus(body['status']);
			const count = await adapter.purgeJobs(olderThanMs, status);
			res.json({ purged: count });
		} catch (err: unknown) {
			handleError(res, err);
		}
	});

	return router;
}

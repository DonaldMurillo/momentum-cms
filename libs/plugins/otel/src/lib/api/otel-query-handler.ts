/**
 * OTel Query Handler
 *
 * Express Router that serves the observability summary, history,
 * export, and purge endpoints for the admin dashboard.
 * Admin-gated using type guards (no assertions).
 */

import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import type { MetricsStore } from '../metrics/metrics-store';
import type { MetricsSnapshotService } from '../metrics/metrics-snapshot-service';
import { createLogger } from '@momentumcms/logger';
import { isFindable, isRecord, type MomentumAPILike } from './otel-api-guards';

const logger = createLogger('OTel-API');

function getUser(req: Request): Record<string, unknown> | null {
	if (!('user' in req)) return null;
	const user: unknown = req['user'];
	if (user == null || typeof user !== 'object') return null;
	if (!('id' in user)) return null;
	return user;
}

function isAuthenticated(req: Request): boolean {
	return getUser(req) != null;
}

function isAdmin(req: Request): boolean {
	const user = getUser(req);
	if (!user) return false;
	return 'role' in user && user['role'] === 'admin';
}

function requireAdmin(req: Request, res: Response): boolean {
	if (!isAuthenticated(req)) {
		res.status(401).json({ error: 'Authentication required' });
		return false;
	}
	if (!isAdmin(req)) {
		res.status(403).json({ error: 'Admin role required' });
		return false;
	}
	return true;
}

function buildTimeRangeWhere(req: Request): Record<string, unknown> {
	const where: Record<string, unknown> = {};
	const from = req.query['from'];
	const to = req.query['to'];

	if (typeof from === 'string' || typeof to === 'string') {
		const createdAt: Record<string, unknown> = {};
		if (typeof from === 'string') createdAt['gte'] = from;
		if (typeof to === 'string') createdAt['lte'] = to;
		where['createdAt'] = createdAt;
	}

	return where;
}

/**
 * Creates an Express Router that serves OTel endpoints.
 *
 * `GET /api/otel/summary` — live metrics snapshot
 * `GET /api/otel/history` — persisted snapshots with time range
 * `DELETE /api/otel/history` — purge all snapshots
 * `GET /api/otel/export` — streaming CSV download
 */
export function createOtelQueryRouter(
	store: MetricsStore,
	getApi?: () => MomentumAPILike | null,
	snapshotService?: MetricsSnapshotService | null,
): Router {
	const router = createRouter();

	// Live summary
	router.get('/summary', (req: Request, res: Response) => {
		if (!requireAdmin(req, res)) return;
		res.json(store.getSummary());
	});

	// Persisted history
	router.get('/history', async (req: Request, res: Response) => {
		if (!requireAdmin(req, res)) return;

		try {
			const api = getApi?.();
			if (!api) {
				res.json({ snapshots: [], total: 0 });
				return;
			}

			const ops = api.setContext({ overrideAccess: true }).collection('otel-snapshots');
			if (!isFindable(ops)) {
				res.json({ snapshots: [], total: 0 });
				return;
			}

			const limit = Math.min(Number(req.query['limit']) || 100, 500);
			const page = Math.max(Number(req.query['page']) || 1, 1);
			const where = buildTimeRangeWhere(req);

			const result = await ops.find({ where, limit, page, sort: '-createdAt' });
			const docs = Array.isArray(result.docs) ? result.docs : [];

			res.json({
				snapshots: docs,
				total: typeof result.totalDocs === 'number' ? result.totalDocs : docs.length,
			});
		} catch (err) {
			logger.error('Failed to fetch history', err instanceof Error ? err : new Error(String(err)));
			res.status(500).json({ error: 'Failed to fetch metrics history' });
		}
	});

	// Purge all history
	router.delete('/history', async (req: Request, res: Response) => {
		if (!requireAdmin(req, res)) return;

		try {
			const deleted = (await snapshotService?.purgeAll()) ?? 0;
			res.json({ deleted });
		} catch (err) {
			logger.error('Failed to purge history', err instanceof Error ? err : new Error(String(err)));
			res.status(500).json({ error: 'Failed to purge metrics history' });
		}
	});

	// Streaming CSV export
	router.get('/export', async (req: Request, res: Response) => {
		if (!requireAdmin(req, res)) return;

		try {
			const api = getApi?.();
			if (!api) {
				res.status(503).json({ error: 'API not available' });
				return;
			}

			const ops = api.setContext({ overrideAccess: true }).collection('otel-snapshots');
			if (!isFindable(ops)) {
				res.status(503).json({ error: 'Snapshots collection not available' });
				return;
			}

			const where = buildTimeRangeWhere(req);

			const date = new Date().toISOString().slice(0, 10);
			res.setHeader('Content-Type', 'text/csv');
			res.setHeader('Content-Disposition', `attachment; filename="otel-metrics-${date}.csv"`);

			// CSV header
			res.write(
				'timestamp,totalRequests,errorCount,avgDurationMs,memoryUsageMb,byMethod,byStatusCode,collectionMetrics\n',
			);

			// Paginate and stream
			let currentPage = 1;
			let hasMore = true;
			const batchSize = 50;

			while (hasMore) {
				const result = await ops.find({
					where,
					limit: batchSize,
					page: currentPage,
					sort: '-createdAt',
				});

				const docs = Array.isArray(result.docs) ? result.docs : [];
				if (docs.length === 0) {
					hasMore = false;
					break;
				}

				for (const doc of docs) {
					if (!isRecord(doc)) continue;

					const timestamp = typeof doc['createdAt'] === 'string' ? doc['createdAt'] : '';
					const totalReqs = typeof doc['totalRequests'] === 'number' ? doc['totalRequests'] : 0;
					const errors = typeof doc['errorCount'] === 'number' ? doc['errorCount'] : 0;
					const avgMs = typeof doc['avgDurationMs'] === 'number' ? doc['avgDurationMs'] : 0;
					const memMb = typeof doc['memoryUsageMb'] === 'number' ? doc['memoryUsageMb'] : 0;
					const byMethod = csvEscape(JSON.stringify(doc['byMethod'] ?? {}));
					const byStatus = csvEscape(JSON.stringify(doc['byStatusCode'] ?? {}));
					const colMetrics = csvEscape(JSON.stringify(doc['collectionMetrics'] ?? []));

					res.write(
						`${timestamp},${totalReqs},${errors},${avgMs},${memMb},${byMethod},${byStatus},${colMetrics}\n`,
					);
				}

				const totalPages = typeof result.totalPages === 'number' ? result.totalPages : 1;
				hasMore = currentPage < totalPages;
				currentPage++;
			}

			res.end();
		} catch (err) {
			logger.error('Failed to export metrics', err instanceof Error ? err : new Error(String(err)));
			if (!res.headersSent) {
				res.status(500).json({ error: 'Failed to export metrics' });
			} else {
				res.end();
			}
		}
	});

	return router;
}

function csvEscape(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

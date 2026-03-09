import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOtelQueryRouter } from '../api/otel-query-handler';
import { MetricsStore } from '../metrics/metrics-store';
import type { MomentumAPILike } from '../api/otel-api-guards';
import type { Request, Response } from 'express';

function createMockReq(overrides: Partial<Request> = {}): Request {
	return {
		query: {},
		...overrides,
	} as Request;
}

function createMockRes(): Response & { _json: unknown; _status: number } {
	const res = {
		_json: null as unknown,
		_status: 200,
		status(code: number) {
			res._status = code;
			return res;
		},
		json(data: unknown) {
			res._json = data;
			return res;
		},
		setHeader: vi.fn(),
		write: vi.fn(),
		end: vi.fn(),
		headersSent: false,
	} as unknown as Response & { _json: unknown; _status: number };
	return res;
}

function createAdminReq(overrides: Partial<Request> = {}): Request {
	return createMockReq({
		user: { id: 'admin-1', role: 'admin' },
		...overrides,
	});
}

describe('otelQueryRouter', () => {
	let store: MetricsStore;

	beforeEach(() => {
		store = new MetricsStore();
	});

	describe('error response sanitization', () => {
		it('should NOT leak internal error details in /history response', async () => {
			const internalError = new Error(
				'relation "public.otel_snapshots" does not exist at character 15',
			);

			const ops = {
				find: vi.fn().mockRejectedValue(internalError),
			};

			const api: MomentumAPILike = {
				collection: vi.fn().mockReturnValue(ops),
				setContext: vi.fn().mockReturnThis(),
			};

			const router = createOtelQueryRouter(store, () => api);

			const req = createAdminReq({ query: {} });
			const res = createMockRes();

			// Find the GET /history handler
			const layer = router.stack.find(
				(l: { route?: { path: string; methods: Record<string, boolean> } }) =>
					l.route?.path === '/history' && l.route?.methods?.get,
			);
			expect(layer).toBeDefined();

			if (layer?.route?.stack?.[0]) {
			await layer.route.stack[0].handle(req, res);
		}

			expect(res._status).toBe(500);
			// The response should NOT contain the raw internal error message
			const body = res._json as { error: string };
			expect(body.error).not.toContain('relation');
			expect(body.error).not.toContain('public.otel_snapshots');
			expect(body.error).not.toContain('character 15');
		});

		it('should NOT leak internal error details in DELETE /history response', async () => {
			const internalError = new Error(
				'ECONNREFUSED 127.0.0.1:5432 - could not connect to database',
			);

			const { MetricsSnapshotService } = await import(
				'../metrics/metrics-snapshot-service'
			);

			const snapshotService = new MetricsSnapshotService({
				store,
				getApi: () => null,
			});
			vi.spyOn(snapshotService, 'purgeAll').mockRejectedValue(internalError);

			const router = createOtelQueryRouter(store, () => null, snapshotService);

			const req = createAdminReq({ query: {} });
			const res = createMockRes();

			const layer = router.stack.find(
				(l: { route?: { path: string; methods: Record<string, boolean> } }) =>
					l.route?.path === '/history' && l.route?.methods?.delete,
			);
			expect(layer).toBeDefined();

			if (layer?.route?.stack?.[0]) {
			await layer.route.stack[0].handle(req, res);
		}

			expect(res._status).toBe(500);
			const body = res._json as { error: string };
			expect(body.error).not.toContain('ECONNREFUSED');
			expect(body.error).not.toContain('127.0.0.1');
			expect(body.error).not.toContain('5432');
		});

		it('should NOT leak internal error details in /export response', async () => {
			const internalError = new Error(
				'column "createdAt" of relation "otel_snapshots" does not exist',
			);

			const ops = {
				find: vi.fn().mockRejectedValue(internalError),
			};

			const api: MomentumAPILike = {
				collection: vi.fn().mockReturnValue(ops),
				setContext: vi.fn().mockReturnThis(),
			};

			const router = createOtelQueryRouter(store, () => api);

			const req = createAdminReq({ query: {} });
			const res = createMockRes();

			const layer = router.stack.find(
				(l: { route?: { path: string; methods: Record<string, boolean> } }) =>
					l.route?.path === '/export' && l.route?.methods?.get,
			);
			expect(layer).toBeDefined();

			if (layer?.route?.stack?.[0]) {
			await layer.route.stack[0].handle(req, res);
		}

			expect(res._status).toBe(500);
			const body = res._json as { error: string };
			expect(body.error).not.toContain('column');
			expect(body.error).not.toContain('otel_snapshots');
		});
	});
});

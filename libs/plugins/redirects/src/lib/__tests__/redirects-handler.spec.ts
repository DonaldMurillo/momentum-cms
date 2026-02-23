import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createRedirectsRouter } from '../redirects-handler';
import type { MomentumAPI } from '@momentumcms/core';

function mockReq(path: string): Request {
	return { path, url: path, method: 'GET' } as Request;
}

function mockRes(): Response & { redirectCalledWith?: [number, string] } {
	const res = {
		redirect: vi.fn(function (
			this: Response & { redirectCalledWith?: [number, string] },
			status: number,
			url: string,
		) {
			this.redirectCalledWith = [status, url];
		}),
	} as unknown as Response & { redirectCalledWith?: [number, string] };
	return res;
}

function mockNext(): NextFunction {
	return vi.fn();
}

function createMockApi(docs: Record<string, unknown>[] = []): MomentumAPI {
	return {
		collection: vi.fn().mockReturnValue({
			find: vi.fn().mockResolvedValue({ docs }),
		}),
		getConfig: vi.fn(),
	} as unknown as MomentumAPI;
}

function invokeMiddleware(
	router: ReturnType<typeof createRedirectsRouter>['router'],
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	return new Promise<void>((resolve) => {
		// Express router is a function with (req, res, next) signature
		// For unit tests, we invoke the handler stack manually
		const handler = router as unknown as (req: Request, res: Response, next: NextFunction) => void;
		handler(req, res, () => {
			(next as ReturnType<typeof vi.fn>)();
			resolve();
		});
		// Give async handler time to resolve
		setTimeout(resolve, 50);
	});
}

describe('createRedirectsRouter', () => {
	it('should return a router and invalidateCache function', () => {
		const { router, invalidateCache } = createRedirectsRouter(() => null);
		expect(router).toBeDefined();
		expect(typeof invalidateCache).toBe('function');
	});

	it('should call next() when API is null (not ready)', async () => {
		const { router } = createRedirectsRouter(() => null);
		const req = mockReq('/some-path');
		const res = mockRes();
		const next = mockNext();

		await invokeMiddleware(router, req, res, next);

		expect(next).toHaveBeenCalled();
		expect(res.redirect).not.toHaveBeenCalled();
	});

	it('should call next() when no matching redirect', async () => {
		const api = createMockApi([
			{ from: '/old-page', to: '/new-page', type: 'permanent', active: true },
		]);
		const { router } = createRedirectsRouter(() => api);
		const req = mockReq('/unmatched-path');
		const res = mockRes();
		const next = mockNext();

		await invokeMiddleware(router, req, res, next);

		expect(next).toHaveBeenCalled();
		expect(res.redirect).not.toHaveBeenCalled();
	});

	it('should redirect with 301 when path matches', async () => {
		const api = createMockApi([
			{ from: '/old-page', to: '/new-page', type: 'permanent', active: true },
		]);
		const { router } = createRedirectsRouter(() => api);
		const req = mockReq('/old-page');
		const res = mockRes();
		const next = mockNext();

		await invokeMiddleware(router, req, res, next);

		expect(res.redirect).toHaveBeenCalledWith(301, '/new-page');
	});

	it('should redirect with 302 for temporary redirects', async () => {
		const api = createMockApi([
			{ from: '/temp', to: '/temp-dest', type: 'temporary', active: true },
		]);
		const { router } = createRedirectsRouter(() => api);
		const req = mockReq('/temp');
		const res = mockRes();
		const next = mockNext();

		await invokeMiddleware(router, req, res, next);

		expect(res.redirect).toHaveBeenCalledWith(302, '/temp-dest');
	});

	it('should support external URLs in "to" field', async () => {
		const api = createMockApi([
			{ from: '/external', to: 'https://example.com/page', type: 'permanent', active: true },
		]);
		const { router } = createRedirectsRouter(() => api);
		const req = mockReq('/external');
		const res = mockRes();
		const next = mockNext();

		await invokeMiddleware(router, req, res, next);

		expect(res.redirect).toHaveBeenCalledWith(301, 'https://example.com/page');
	});

	it('should only match active redirects', async () => {
		const api = createMockApi([
			{ from: '/inactive', to: '/dest', type: 'permanent', active: false },
		]);
		const { router } = createRedirectsRouter(() => api);
		const req = mockReq('/inactive');
		const res = mockRes();
		const next = mockNext();

		await invokeMiddleware(router, req, res, next);

		expect(next).toHaveBeenCalled();
		expect(res.redirect).not.toHaveBeenCalled();
	});

	it('should query API with active filter', async () => {
		const findFn = vi.fn().mockResolvedValue({
			docs: [{ from: '/test', to: '/dest', type: 'permanent', active: true }],
		});
		const api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		const { router } = createRedirectsRouter(() => api);
		await invokeMiddleware(router, mockReq('/test'), mockRes(), mockNext());

		expect(api.collection).toHaveBeenCalledWith('redirects');
		expect(findFn).toHaveBeenCalledWith(
			expect.objectContaining({ where: { active: { equals: true } } }),
		);
	});

	it('should cache results — second request does not re-query API', async () => {
		const findFn = vi.fn().mockResolvedValue({
			docs: [{ from: '/cached', to: '/dest', type: 'permanent', active: true }],
		});
		const api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		const { router } = createRedirectsRouter(() => api, { cacheTtl: 60_000 });
		const req1 = mockReq('/cached');
		const req2 = mockReq('/cached');

		await invokeMiddleware(router, req1, mockRes(), mockNext());
		await invokeMiddleware(router, req2, mockRes(), mockNext());

		expect(findFn).toHaveBeenCalledTimes(1);
	});

	it('should re-query after cache expires', async () => {
		const findFn = vi.fn().mockResolvedValue({
			docs: [{ from: '/expiry', to: '/dest', type: 'permanent', active: true }],
		});
		const api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		const { router } = createRedirectsRouter(() => api, { cacheTtl: 1 });
		const req = mockReq('/expiry');

		await invokeMiddleware(router, req, mockRes(), mockNext());
		// Wait for cache to expire
		await new Promise((resolve) => setTimeout(resolve, 10));
		await invokeMiddleware(router, req, mockRes(), mockNext());

		expect(findFn).toHaveBeenCalledTimes(2);
	});

	it('should re-query after invalidateCache() is called', async () => {
		const findFn = vi.fn().mockResolvedValue({
			docs: [{ from: '/invalidated', to: '/dest', type: 'permanent', active: true }],
		});
		const api = {
			collection: vi.fn().mockReturnValue({ find: findFn }),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		const { router, invalidateCache } = createRedirectsRouter(() => api, { cacheTtl: 60_000 });
		const req = mockReq('/invalidated');

		await invokeMiddleware(router, req, mockRes(), mockNext());
		invalidateCache();
		await invokeMiddleware(router, req, mockRes(), mockNext());

		expect(findFn).toHaveBeenCalledTimes(2);
	});

	it('should handle API errors gracefully (calls next)', async () => {
		const api = {
			collection: vi.fn().mockReturnValue({
				find: vi.fn().mockRejectedValue(new Error('DB down')),
			}),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		const { router } = createRedirectsRouter(() => api);
		const req = mockReq('/error-path');
		const res = mockRes();
		const next = mockNext();

		await invokeMiddleware(router, req, res, next);

		expect(next).toHaveBeenCalled();
		expect(res.redirect).not.toHaveBeenCalled();
	});

	it('should default type to 301 when type is missing or invalid', async () => {
		const api = createMockApi([{ from: '/no-type', to: '/dest', active: true }]);
		const { router } = createRedirectsRouter(() => api);
		const req = mockReq('/no-type');
		const res = mockRes();
		const next = mockNext();

		await invokeMiddleware(router, req, res, next);

		expect(res.redirect).toHaveBeenCalledWith(301, '/dest');
	});
});

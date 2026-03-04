import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { SessionMiddleware } from './session.middleware';

describe('SessionMiddleware', () => {
	it('should call next() even when no session resolver is set', () => {
		const middleware = new SessionMiddleware();
		const req = {} as never;
		const res = {} as never;
		const next = vi.fn();

		middleware.use(req, res, next);
		expect(next).toHaveBeenCalled();
	});

	it('should call next() and not throw when session resolution fails', async () => {
		const middleware = new SessionMiddleware();
		middleware.setSessionResolver(async () => {
			throw new Error('Auth failed');
		});

		const req = {} as never;
		const res = {} as never;
		const next = vi.fn();

		await middleware.use(req, res, next);
		expect(next).toHaveBeenCalled();
	});

	it('should attach user to request when session resolves', async () => {
		const middleware = new SessionMiddleware();
		const user = { id: 'user-1', email: 'a@b.com', role: 'admin' };
		middleware.setSessionResolver(async () => user);

		const req: Record<string, unknown> = {};
		const res = {} as never;
		const next = vi.fn();

		await middleware.use(req as never, res, next);
		expect(req['user']).toEqual(user);
		expect(next).toHaveBeenCalled();
	});
});

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { of, firstValueFrom } from 'rxjs';
import { MomentumResponseInterceptor } from './momentum-response.interceptor';

function createMockContext(statusFn: ReturnType<typeof vi.fn>) {
	return {
		switchToHttp: () => ({
			getResponse: () => ({ status: statusFn }),
		}),
	};
}

describe('MomentumResponseInterceptor', () => {
	const interceptor = new MomentumResponseInterceptor();

	it('should set HTTP status from MomentumResponse.status', async () => {
		const statusFn = vi.fn();
		const ctx = createMockContext(statusFn);
		const handler = { handle: () => of({ status: 201, doc: { id: '1' } }) };

		const data = await firstValueFrom(interceptor.intercept(ctx as never, handler as never));
		expect(statusFn).toHaveBeenCalledWith(201);
		expect(data).toEqual({ status: 201, doc: { id: '1' } });
	});

	it('should not call status when no status field', async () => {
		const statusFn = vi.fn();
		const ctx = createMockContext(statusFn);
		const handler = { handle: () => of({ docs: [] }) };

		const data = await firstValueFrom(interceptor.intercept(ctx as never, handler as never));
		expect(statusFn).not.toHaveBeenCalled();
		expect(data).toEqual({ docs: [] });
	});

	it('should sanitize error messages containing SQL for 500 responses', async () => {
		const statusFn = vi.fn();
		const ctx = createMockContext(statusFn);
		const handler = {
			handle: () => of({ status: 500, error: 'SELECT * FROM users WHERE id = 1' }),
		};

		const data = await firstValueFrom(interceptor.intercept(ctx as never, handler as never));
		expect((data as Record<string, unknown>)['error']).toBe('Internal server error');
	});

	it('should sanitize error messages containing file paths for 500 responses', async () => {
		const statusFn = vi.fn();
		const ctx = createMockContext(statusFn);
		const handler = {
			handle: () => of({ status: 500, error: 'ENOENT: /var/lib/app/data/users.db' }),
		};

		const data = await firstValueFrom(interceptor.intercept(ctx as never, handler as never));
		expect((data as Record<string, unknown>)['error']).toBe('Internal server error');
	});

	it('should NOT sanitize error messages for 4xx responses', async () => {
		const statusFn = vi.fn();
		const ctx = createMockContext(statusFn);
		const handler = {
			handle: () => of({ status: 400, error: 'Validation failed' }),
		};

		const data = await firstValueFrom(interceptor.intercept(ctx as never, handler as never));
		expect((data as Record<string, unknown>)['error']).toBe('Validation failed');
	});
});

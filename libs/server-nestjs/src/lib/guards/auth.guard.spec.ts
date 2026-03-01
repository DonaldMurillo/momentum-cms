import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { MomentumAuthGuard } from './auth.guard';

function createMockContext(user?: unknown) {
	return {
		switchToHttp: () => ({
			getRequest: () => ({ user }),
		}),
	};
}

describe('MomentumAuthGuard', () => {
	const guard = new MomentumAuthGuard();

	it('should allow when req.user exists', () => {
		const ctx = createMockContext({ id: 'user-1', role: 'admin' });
		expect(guard.canActivate(ctx as never)).toBe(true);
	});

	it('should throw UnauthorizedException when no user', () => {
		const ctx = createMockContext(undefined);
		expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
	});

	it('should throw UnauthorizedException when user is null', () => {
		const ctx = createMockContext(null);
		expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
	});
});

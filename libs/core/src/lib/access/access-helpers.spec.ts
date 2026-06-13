import { describe, it, expect } from 'vitest';
import {
	access,
	allowAll,
	denyAll,
	isAuthenticated,
	hasRole,
	hasAnyRole,
	hasAllRoles,
	and,
	or,
	not,
	isOwner,
} from './access-helpers';
import type { AccessFunction } from '../collections/collection.types';

function makeReq(user?: { id: string; role?: string; [key: string]: unknown }) {
	return { user };
}

function makeArgs(
	user?: { id: string; role?: string; [key: string]: unknown },
	data?: Record<string, unknown>,
) {
	return { req: makeReq(user), data };
}

describe('access', () => {
	it('should pass undefined user to callback when no user on request', async () => {
		const fn = access(({ user }) => {
			expect(user).toBeUndefined();
			return true;
		});
		await fn(makeArgs());
	});

	it('should pass user to callback', async () => {
		const fn = access(({ user }) => {
			expect(user?.id).toBe('u1');
			return true;
		});
		await fn(makeArgs({ id: 'u1', role: 'admin' }));
	});
});

describe('allowAll', () => {
	it('should return true', async () => {
		const fn = allowAll();
		expect(await fn(makeArgs())).toBe(true);
	});
});

describe('denyAll', () => {
	it('should return false', async () => {
		const fn = denyAll();
		expect(await fn(makeArgs())).toBe(false);
	});
});

describe('isAuthenticated', () => {
	it('should return true for authenticated user', async () => {
		expect(await isAuthenticated()(makeArgs({ id: 'u1' }))).toBe(true);
	});

	it('should return false for unauthenticated request', async () => {
		expect(await isAuthenticated()(makeArgs())).toBe(false);
	});
});

describe('hasRole', () => {
	it('should return true when user has the exact role', async () => {
		expect(await hasRole('admin')(makeArgs({ id: 'u1', role: 'admin' }))).toBe(true);
	});

	it('should return false when user has a different role', async () => {
		expect(await hasRole('admin')(makeArgs({ id: 'u1', role: 'editor' }))).toBe(false);
	});

	it('should return false when user has no role property', async () => {
		expect(await hasRole('admin')(makeArgs({ id: 'u1' }))).toBe(false);
	});

	it('should return false when no user', async () => {
		expect(await hasRole('admin')(makeArgs())).toBe(false);
	});
});

describe('hasAnyRole', () => {
	it('should return true when user role is in the list', async () => {
		expect(await hasAnyRole(['admin', 'editor'])(makeArgs({ id: 'u1', role: 'editor' }))).toBe(
			true,
		);
	});

	it('should return false when user role is not in the list', async () => {
		expect(await hasAnyRole(['admin', 'editor'])(makeArgs({ id: 'u1', role: 'viewer' }))).toBe(
			false,
		);
	});

	it('should return false for empty roles array (HIGH-RISK)', async () => {
		// Empty roles array → no role can match → always false
		expect(await hasAnyRole([])(makeArgs({ id: 'u1', role: 'admin' }))).toBe(false);
	});

	it('should return false when no user', async () => {
		expect(await hasAnyRole(['admin'])(makeArgs())).toBe(false);
	});

	it('should return false when user has no role', async () => {
		expect(await hasAnyRole(['admin'])(makeArgs({ id: 'u1' }))).toBe(false);
	});
});

describe('hasAllRoles', () => {
	it('should return true when user has all required roles', async () => {
		expect(
			await hasAllRoles(['admin', 'verified'])(
				makeArgs({ id: 'u1', role: 'admin', roles: ['admin', 'verified'] }),
			),
		).toBe(true);
	});

	it('should return false when user is missing a role', async () => {
		expect(
			await hasAllRoles(['admin', 'verified'])(
				makeArgs({ id: 'u1', role: 'admin', roles: ['admin'] }),
			),
		).toBe(false);
	});

	it('should return false when user has no roles property', async () => {
		expect(await hasAllRoles(['admin'])(makeArgs({ id: 'u1', role: 'admin' }))).toBe(false);
	});

	it('should return true for empty required roles (vacuously true)', async () => {
		// No roles required → everyone passes
		expect(await hasAllRoles([])(makeArgs({ id: 'u1', role: 'admin', roles: [] }))).toBe(true);
	});
});

describe('and', () => {
	it('should return true when all conditions pass', async () => {
		const fn = and(isAuthenticated(), hasRole('admin'));
		expect(await fn(makeArgs({ id: 'u1', role: 'admin' }))).toBe(true);
	});

	it('should return false when one condition fails', async () => {
		const fn = and(isAuthenticated(), hasRole('admin'));
		expect(await fn(makeArgs({ id: 'u1', role: 'editor' }))).toBe(false);
	});

	it('should return true with zero arguments (vacuously true, HIGH-RISK)', async () => {
		const fn = and();
		expect(await fn(makeArgs())).toBe(true);
	});

	it('should work with mixed sync and async access functions', async () => {
		const syncFn: AccessFunction = () => true;
		const asyncFn: AccessFunction = async () => true;
		const fn = and(syncFn, asyncFn);
		expect(await fn(makeArgs())).toBe(true);
	});
});

describe('or', () => {
	it('should return true when any condition passes', async () => {
		const fn = or(hasRole('admin'), hasRole('editor'));
		expect(await fn(makeArgs({ id: 'u1', role: 'editor' }))).toBe(true);
	});

	it('should return false when all conditions fail', async () => {
		const fn = or(hasRole('admin'), hasRole('editor'));
		expect(await fn(makeArgs({ id: 'u1', role: 'viewer' }))).toBe(false);
	});

	it('should return false with zero arguments (HIGH-RISK)', async () => {
		const fn = or();
		expect(await fn(makeArgs())).toBe(false);
	});
});

describe('not', () => {
	it('should negate true to false', async () => {
		const fn = not(allowAll());
		expect(await fn(makeArgs())).toBe(false);
	});

	it('should negate false to true', async () => {
		const fn = not(denyAll());
		expect(await fn(makeArgs())).toBe(true);
	});
});

describe('isOwner', () => {
	it('should return true when user.id matches createdBy', async () => {
		const fn = isOwner();
		expect(await fn(makeArgs({ id: 'u1' }, { createdBy: 'u1' }))).toBe(true);
	});

	it('should return false when user.id does not match createdBy', async () => {
		const fn = isOwner();
		expect(await fn(makeArgs({ id: 'u1' }, { createdBy: 'u2' }))).toBe(false);
	});

	it('should return false when no data', async () => {
		const fn = isOwner();
		expect(await fn(makeArgs({ id: 'u1' }))).toBe(false);
	});

	it('should return false when data has no owner field', async () => {
		const fn = isOwner();
		expect(await fn(makeArgs({ id: 'u1' }, {}))).toBe(false);
	});

	it('should return false when no user', async () => {
		const fn = isOwner();
		expect(await fn(makeArgs(undefined, { createdBy: 'u1' }))).toBe(false);
	});

	it('should handle type coercion (number id vs string ownerId)', async () => {
		const fn = isOwner();
		expect(await fn(makeArgs({ id: '123' }, { createdBy: 123 }))).toBe(true);
		expect(await fn(makeArgs({ id: 123 }, { createdBy: '123' }))).toBe(true);
	});

	it('should support custom owner field', async () => {
		const fn = isOwner('authorId');
		expect(await fn(makeArgs({ id: 'u1' }, { authorId: 'u1' }))).toBe(true);
	});

	it('should return false for null createdBy', async () => {
		const fn = isOwner();
		expect(await fn(makeArgs({ id: 'u1' }, { createdBy: null }))).toBe(false);
	});
});

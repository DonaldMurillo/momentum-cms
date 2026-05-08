import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { extractUser } from './extract-user';

describe('extractUser', () => {
	it('returns users with string ids', () => {
		const req = { user: { id: 'user-1', role: 'admin' } } as unknown as Request;

		expect(extractUser(req)).toEqual({ id: 'user-1', role: 'admin' });
	});

	it('returns users with numeric ids', () => {
		const req = { user: { id: 42, role: 'editor' } } as unknown as Request;

		expect(extractUser(req)).toEqual({ id: 42, role: 'editor' });
	});

	it('returns undefined for missing or empty ids', () => {
		expect(extractUser({ user: { role: 'editor' } } as unknown as Request)).toBeUndefined();
		expect(extractUser({ user: { id: '' } } as unknown as Request)).toBeUndefined();
	});
});

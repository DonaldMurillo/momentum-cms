import { describe, it, expect } from 'vitest';
import { extractUserContext } from '../auth';
import type { Request } from 'express';

function makeReq(user?: Record<string, unknown>): Request {
	return { user } as unknown as Request;
}

describe('extractUserContext', () => {
	it('should return user when present on request', () => {
		const req = makeReq({ id: 'u1', email: 'admin@test.com', role: 'admin' });
		const user = extractUserContext(req);
		expect(user).toEqual({ id: 'u1', email: 'admin@test.com', role: 'admin' });
	});

	it('should return null when no user on request', () => {
		const req = makeReq();
		expect(extractUserContext(req)).toBeNull();
	});

	it('should return null when user is not an object', () => {
		const req = makeReq('not-an-object' as unknown as Record<string, unknown>);
		expect(extractUserContext(req)).toBeNull();
	});

	it('should return null when user has no id', () => {
		const req = makeReq({ email: 'test@test.com' });
		expect(extractUserContext(req)).toBeNull();
	});

	it('should return null when id is not a string (numeric, boolean, object)', () => {
		expect(extractUserContext(makeReq({ id: 0 }))).toBeNull();
		expect(extractUserContext(makeReq({ id: 42 }))).toBeNull();
		expect(extractUserContext(makeReq({ id: true }))).toBeNull();
		expect(extractUserContext(makeReq({ id: { nested: 'x' } }))).toBeNull();
	});

	it('should return null when id is an empty string', () => {
		expect(extractUserContext(makeReq({ id: '' }))).toBeNull();
	});
});

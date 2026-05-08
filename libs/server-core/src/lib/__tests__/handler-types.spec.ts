/**
 * Compile-time + runtime test: HandlerResult type is exported from handler-types.
 * If this file fails to compile, the type extraction (Fix B) is incomplete.
 */
import { describe, expect, it } from 'vitest';
import type { HandlerResult } from '../handler-types';

describe('HandlerResult type extraction (Fix B)', () => {
	it('exports HandlerResult with expected shape', () => {
		// Verify runtime shape matches the interface
		const result: HandlerResult<{ data: string }> = {
			status: 200,
			body: { data: 'test' },
		};
		expect(result.status).toBe(200);
		expect(result.body.data).toBe('test');
	});

	it('supports optional headers field', () => {
		const result: HandlerResult = {
			status: 301,
			body: null,
			headers: { Location: '/new-url' },
		};
		expect(result.headers).toEqual({ Location: '/new-url' });
	});

	it('works without generic parameter (defaults to unknown)', () => {
		const result: HandlerResult = {
			status: 404,
			body: { error: 'not found' },
		};
		expect(result.status).toBe(404);
	});
});

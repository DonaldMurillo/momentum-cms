import { describe, it, expect } from 'vitest';
import { SeoAnalysis } from '../seo-analysis-collection';
import type { AccessArgs } from '@momentumcms/core';

function buildAccessArgs(user?: { role?: string }): AccessArgs {
	return {
		req: { user: user ? { id: '1', email: 'test@test.com', ...user } : undefined },
	};
}

describe('SeoAnalysis collection access control', () => {
	it('should be a managed collection (no auto-generated REST routes)', () => {
		expect(SeoAnalysis.managed).toBe(true);
	});

	it('should allow read access for internal calls (no user)', () => {
		const readFn = SeoAnalysis.access?.read;
		expect(readFn).toBeDefined();
		// Internal plugin call — no user context (safe because managed: true)
		const result = readFn!(buildAccessArgs(undefined));
		expect(result).toBe(true);
	});

	it('should allow read access to admin users', () => {
		const readFn = SeoAnalysis.access?.read;
		expect(readFn).toBeDefined();
		const result = readFn!(buildAccessArgs({ role: 'admin' }));
		expect(result).toBe(true);
	});

	it('should deny read access to non-admin users', () => {
		const readFn = SeoAnalysis.access?.read;
		expect(readFn).toBeDefined();
		const result = readFn!(buildAccessArgs({ role: 'editor' }));
		expect(result).toBe(false);
	});

	it('should allow create access for internal calls (no user)', () => {
		const createFn = SeoAnalysis.access?.create;
		expect(createFn).toBeDefined();
		// Internal plugin call — no user context
		const result = createFn!(buildAccessArgs(undefined));
		expect(result).toBe(true);
	});

	it('should allow create access for admin users', () => {
		const createFn = SeoAnalysis.access?.create;
		expect(createFn).toBeDefined();
		const result = createFn!(buildAccessArgs({ role: 'admin' }));
		expect(result).toBe(true);
	});

	it('should deny delete access to unauthenticated requests', () => {
		const deleteFn = SeoAnalysis.access?.delete;
		expect(deleteFn).toBeDefined();
		const result = deleteFn!(buildAccessArgs(undefined));
		expect(result).toBe(false);
	});

	it('should allow delete access to admin users', () => {
		const deleteFn = SeoAnalysis.access?.delete;
		expect(deleteFn).toBeDefined();
		const result = deleteFn!(buildAccessArgs({ role: 'admin' }));
		expect(result).toBe(true);
	});
});

import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
	it('should run tests successfully', () => {
		expect(true).toBe(true);
	});

	it('should have access to vitest globals', () => {
		expect(typeof describe).toBe('function');
		expect(typeof it).toBe('function');
		expect(typeof expect).toBe('function');
	});
});

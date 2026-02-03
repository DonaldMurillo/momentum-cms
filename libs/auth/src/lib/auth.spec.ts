import { describe, it, expect } from 'vitest';
import { createMomentumAuth } from './auth';

describe('createMomentumAuth', () => {
	it('should export createMomentumAuth function', () => {
		expect(typeof createMomentumAuth).toBe('function');
	});
});

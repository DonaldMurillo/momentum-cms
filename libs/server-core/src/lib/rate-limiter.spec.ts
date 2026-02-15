import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should allow requests up to the limit', () => {
		const limiter = new RateLimiter(3);
		expect(limiter.isAllowed('ip1')).toBe(true);
		expect(limiter.isAllowed('ip1')).toBe(true);
		expect(limiter.isAllowed('ip1')).toBe(true);
		expect(limiter.isAllowed('ip1')).toBe(false);
	});

	it('should reject requests over the limit', () => {
		const limiter = new RateLimiter(1);
		expect(limiter.isAllowed('ip1')).toBe(true);
		expect(limiter.isAllowed('ip1')).toBe(false);
		expect(limiter.isAllowed('ip1')).toBe(false);
	});

	it('should reset after the window expires', () => {
		const limiter = new RateLimiter(2);
		expect(limiter.isAllowed('ip1')).toBe(true);
		expect(limiter.isAllowed('ip1')).toBe(true);
		expect(limiter.isAllowed('ip1')).toBe(false);

		// Advance past the 60s window
		vi.advanceTimersByTime(60_001);
		expect(limiter.isAllowed('ip1')).toBe(true);
	});

	it('should track different keys independently', () => {
		const limiter = new RateLimiter(1);
		expect(limiter.isAllowed('ip1')).toBe(true);
		expect(limiter.isAllowed('ip2')).toBe(true);
		expect(limiter.isAllowed('ip1')).toBe(false);
		expect(limiter.isAllowed('ip2')).toBe(false);
	});

	it('should evict expired entries to prevent unbounded memory growth', () => {
		const limiter = new RateLimiter(100);

		// Create 1000 unique IPs
		for (let i = 0; i < 1000; i++) {
			limiter.isAllowed(`ip-${i}`);
		}
		expect(limiter.size).toBe(1000);

		// Advance past the window + cleanup interval
		vi.advanceTimersByTime(61_000);

		// Trigger cleanup by making a new request
		limiter.isAllowed('trigger-cleanup');

		// Expired entries should be evicted; only the new one remains
		expect(limiter.size).toBe(1);
	});

	it('should not evict entries that are still within their window', () => {
		const limiter = new RateLimiter(100);

		limiter.isAllowed('ip-old');
		vi.advanceTimersByTime(30_000); // Half the window
		limiter.isAllowed('ip-new');

		// Advance past cleanup interval but ip-new is still valid
		vi.advanceTimersByTime(31_000); // Total: 61s from ip-old, 31s from ip-new

		// Trigger cleanup
		limiter.isAllowed('trigger');

		// ip-old expired (61s > 60s), ip-new still valid (31s < 60s), plus trigger
		expect(limiter.size).toBe(2);
	});
});

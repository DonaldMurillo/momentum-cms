/**
 * Simple in-memory rate limiter with automatic cleanup of expired entries.
 *
 * Tracks request counts per key (typically IP address) within a sliding window.
 * Periodically evicts expired entries to prevent unbounded memory growth.
 */
export class RateLimiter {
	private readonly limits: Map<string, { count: number; resetAt: number }> = new Map();
	private readonly maxPerMinute: number;
	private readonly windowMs: number;
	private lastCleanup = 0;
	private static readonly CLEANUP_INTERVAL = 60_000;

	constructor(maxPerMinute: number, windowMs = 60_000) {
		this.maxPerMinute = maxPerMinute;
		this.windowMs = windowMs;
	}

	/** Number of tracked entries (for monitoring/testing). */
	get size(): number {
		return this.limits.size;
	}

	/** Check if a request from the given key is allowed. */
	isAllowed(key: string): boolean {
		const now = Date.now();
		this.maybeCleanup(now);

		const entry = this.limits.get(key);

		if (!entry || now >= entry.resetAt) {
			this.limits.set(key, { count: 1, resetAt: now + this.windowMs });
			return true;
		}

		if (entry.count >= this.maxPerMinute) {
			return false;
		}

		entry.count++;
		return true;
	}

	/** Evict expired entries if enough time has passed since last cleanup. */
	private maybeCleanup(now: number): void {
		if (now - this.lastCleanup < RateLimiter.CLEANUP_INTERVAL) {
			return;
		}
		this.lastCleanup = now;
		for (const [key, entry] of this.limits) {
			if (now >= entry.resetAt) {
				this.limits.delete(key);
			}
		}
	}
}

/**
 * Simple in-memory TTL cache for sitemap XML.
 */

interface CacheEntry {
	value: string;
	expiresAt: number;
}

export class SitemapCache {
	private readonly store = new Map<string, CacheEntry>();
	private readonly defaultTtl: number;

	constructor(defaultTtl = 300_000) {
		this.defaultTtl = defaultTtl;
	}

	get(key: string): string | null {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return null;
		}
		return entry.value;
	}

	set(key: string, value: string, ttl?: number): void {
		this.store.set(key, {
			value,
			expiresAt: Date.now() + (ttl ?? this.defaultTtl),
		});
	}

	invalidate(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}

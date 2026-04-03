/**
 * LRU Cache Adapter
 *
 * In-memory Least Recently Used cache with tag-based invalidation.
 * Zero external dependencies — uses Map insertion-order for LRU ordering.
 */

import type { CacheAdapter, CacheEntry, CacheStats } from '../cache-adapter.types';

export interface LRUCacheAdapterOptions {
	/** Maximum number of entries. @default 1000 */
	maxSize?: number;
	/** Maximum size of a single cached value in bytes (JSON-serialized). Entries exceeding this are silently skipped. */
	maxValueSize?: number;
}

export class LRUCacheAdapter implements CacheAdapter {
	private readonly cache = new Map<string, CacheEntry>();
	private readonly tagIndex = new Map<string, Set<string>>();
	private readonly maxSize: number;
	private readonly maxValueSize: number | undefined;
	private hits = 0;
	private misses = 0;
	private evictions = 0;

	constructor(options?: LRUCacheAdapterOptions) {
		this.maxSize = options?.maxSize ?? 1000;
		this.maxValueSize = options?.maxValueSize;
	}

	async get<T = unknown>(key: string): Promise<CacheEntry<T> | undefined> {
		const entry = this.cache.get(key);
		if (!entry) {
			this.misses++;
			return undefined;
		}

		// Lazy TTL expiry
		const elapsed = (Date.now() - entry.createdAt) / 1000;
		if (elapsed >= entry.ttl) {
			this.removeEntry(key, entry);
			this.misses++;
			return undefined;
		}

		// Move to end (most recently used) by delete + re-insert
		this.cache.delete(key);
		this.cache.set(key, entry);
		this.hits++;
		// Return a deep clone to prevent mutable reference leaks across requests
		return structuredClone(entry) as CacheEntry<T>; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- Map stores generic entries
	}

	async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
		// Enforce maxValueSize — silently skip oversized entries to prevent memory exhaustion
		if (this.maxValueSize !== undefined) {
			const serialized = JSON.stringify(entry.value);
			if (serialized.length > this.maxValueSize) return;
		}

		// Deep clone to prevent mutable reference leaks — caller mutations won't affect cache
		const cloned = structuredClone(entry);

		// If key already exists, remove old tag associations
		const existing = this.cache.get(key);
		if (existing) {
			this.removeFromTagIndex(key, existing.tags);
			this.cache.delete(key); // Delete to re-insert at end
		}

		// Evict LRU entries if at capacity
		while (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) {
				const firstEntry = this.cache.get(firstKey);
				if (firstEntry) this.removeFromTagIndex(firstKey, firstEntry.tags);
				this.cache.delete(firstKey);
				this.evictions++;
			}
		}

		this.cache.set(key, cloned);

		// Update tag index
		for (const tag of cloned.tags) {
			let tagSet = this.tagIndex.get(tag);
			if (!tagSet) {
				tagSet = new Set();
				this.tagIndex.set(tag, tagSet);
			}
			tagSet.add(key);
		}
	}

	async delete(key: string): Promise<boolean> {
		const entry = this.cache.get(key);
		if (!entry) return false;
		this.removeEntry(key, entry);
		return true;
	}

	async deleteByTag(tag: string): Promise<number> {
		const keys = this.tagIndex.get(tag);
		if (!keys || keys.size === 0) return 0;

		let count = 0;
		// Copy keys to avoid mutation during iteration
		for (const key of [...keys]) {
			const entry = this.cache.get(key);
			if (entry) {
				this.removeEntry(key, entry);
				count++;
			}
		}
		return count;
	}

	async clear(): Promise<void> {
		this.cache.clear();
		this.tagIndex.clear();
	}

	async stats(): Promise<CacheStats> {
		const total = this.hits + this.misses;
		return {
			size: this.cache.size,
			hits: this.hits,
			misses: this.misses,
			hitRate: total === 0 ? 0 : (this.hits / total) * 100,
			evictions: this.evictions,
		};
	}

	private removeEntry(key: string, entry: CacheEntry): void {
		this.cache.delete(key);
		this.removeFromTagIndex(key, entry.tags);
	}

	private removeFromTagIndex(key: string, tags: string[]): void {
		for (const tag of tags) {
			const tagSet = this.tagIndex.get(tag);
			if (tagSet) {
				tagSet.delete(key);
				if (tagSet.size === 0) this.tagIndex.delete(tag);
			}
		}
	}
}

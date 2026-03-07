import { Injectable, signal } from '@angular/core';

type Loader = () => Promise<unknown>;

/**
 * Registry for admin layout slot components.
 *
 * Slots are additive — multiple components can be registered for the same slot key.
 * Per-collection slots use the pattern: `{base-slot}:{collection-slug}`.
 *
 * Resolution merges global + per-collection loaders (global first).
 *
 * The registry is signal-aware: `resolve()` reads an internal version signal,
 * so Angular effects that call `resolve()` will re-run when new slots are registered.
 */
@Injectable({ providedIn: 'root' })
export class AdminSlotRegistry {
	private readonly slots = new Map<string, Loader[]>();

	/** Incremented on every register() so signal-based consumers re-evaluate. */
	private readonly _version = signal(0);

	/** Register a lazy loader for a slot. Multiple loaders per slot are supported. Duplicate loaders are skipped. */
	register(slot: string, loader: Loader): void {
		const existing = this.slots.get(slot) ?? [];
		if (existing.includes(loader)) return;
		existing.push(loader);
		this.slots.set(slot, existing);
		this._version.update((v) => v + 1);
	}

	/** Get all loaders for a slot key. Returns empty array if none registered. */
	getAll(slot: string): Loader[] {
		return this.slots.get(slot) ?? [];
	}

	/** Check if a slot has any registered loaders. */
	has(slot: string): boolean {
		return this.slots.has(slot);
	}

	/**
	 * Resolve slot loaders, merging global and per-collection entries.
	 *
	 * Reads the internal version signal so Angular effects tracking this call
	 * will re-run when new slots are registered.
	 */
	resolve(slot: string, slug?: string): Loader[] {
		this._version();
		const global = this.getAll(slot);
		if (!slug) return global;
		const perCollection = this.getAll(`${slot}:${slug}`);
		return [...global, ...perCollection];
	}
}

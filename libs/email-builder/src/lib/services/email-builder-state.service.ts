import { Injectable, signal, computed, type Signal, type WritableSignal } from '@angular/core';
import type { EmailBlock, EmailTheme } from '@momentumcms/email';

/**
 * Reactive state management for the email builder.
 *
 * Manages blocks, selection, hover, and inserter UI state using signals.
 * Each instance is scoped to its provider (typically per builder component).
 */
@Injectable()
export class EmailBuilderStateService {
	// ─── Block state ───────────────────────────────────────
	private readonly _blocks: WritableSignal<EmailBlock[]> = signal([]);
	readonly blocks: Signal<EmailBlock[]> = this._blocks.asReadonly();

	private readonly _theme: WritableSignal<EmailTheme | undefined> = signal(undefined);
	readonly theme: Signal<EmailTheme | undefined> = this._theme.asReadonly();

	// ─── UI state ──────────────────────────────────────────
	readonly selectedBlockId: WritableSignal<string | null> = signal(null);
	readonly hoveredBlockId: WritableSignal<string | null> = signal(null);
	readonly inserterOpen: WritableSignal<{ index: number } | null> = signal(null);

	// ─── Computed ──────────────────────────────────────────
	readonly blockCount: Signal<number> = computed(() => this._blocks().length);

	readonly selectedBlock: Signal<EmailBlock | null> = computed(() => {
		const id = this.selectedBlockId();
		if (!id) return null;
		return this._blocks().find((b) => b.id === id) ?? null;
	});

	readonly selectedBlockIndex: Signal<number> = computed(() => {
		const id = this.selectedBlockId();
		if (!id) return -1;
		return this._blocks().findIndex((b) => b.id === id);
	});

	// ─── Block operations ──────────────────────────────────

	setBlocks(blocks: EmailBlock[]): void {
		this._blocks.set(blocks);
	}

	setTheme(theme: EmailTheme | undefined): void {
		this._theme.set(theme);
	}

	addBlock(block: EmailBlock, index: number): void {
		this._blocks.update((blocks) => {
			const next = [...blocks];
			next.splice(index, 0, block);
			return next;
		});
		this.selectedBlockId.set(block.id);
		this.inserterOpen.set(null);
	}

	removeBlock(id: string): void {
		this._blocks.update((blocks) => blocks.filter((b) => b.id !== id));
		if (this.selectedBlockId() === id) {
			this.selectedBlockId.set(null);
		}
	}

	moveBlock(fromIndex: number, toIndex: number): void {
		this._blocks.update((blocks) => {
			if (fromIndex < 0 || fromIndex >= blocks.length) return blocks;
			if (toIndex < 0 || toIndex >= blocks.length) return blocks;
			const next = [...blocks];
			const [moved] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, moved);
			return next;
		});
	}

	updateBlockData(id: string, data: Record<string, unknown>): void {
		this._blocks.update((blocks) =>
			blocks.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)),
		);
	}

	duplicateBlock(id: string): void {
		const blocks = this._blocks();
		const index = blocks.findIndex((b) => b.id === id);
		if (index === -1) return;

		const original = blocks[index];
		const duplicate: EmailBlock = {
			...original,
			id: generateBlockId(),
			data: { ...original.data },
		};
		this.addBlock(duplicate, index + 1);
	}

	// ─── UI operations ─────────────────────────────────────

	clearSelection(): void {
		this.selectedBlockId.set(null);
		this.hoveredBlockId.set(null);
		this.inserterOpen.set(null);
	}

	reset(): void {
		this._blocks.set([]);
		this._theme.set(undefined);
		this.clearSelection();
	}
}

/** Generate a short unique block ID. */
export function generateBlockId(): string {
	return Math.random().toString(36).slice(2, 10);
}

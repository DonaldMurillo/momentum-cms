/**
 * Visual Block Editor Component
 *
 * Main orchestrator for the visual block editor. Replaces the form-card-style
 * BlocksFieldRenderer when admin.editor === 'visual'.
 *
 * Renders blocks with header bars (block type, collapse, move/delete controls),
 * drag-drop reorder, and block insertion via command palette.
 *
 * Data flows through the same Signal Forms bridge as BlocksFieldRenderer:
 * - Reads from nodeState.value() -> BlockItem[]
 * - Writes via nodeState.value.set(newArray)
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	forwardRef,
	input,
	signal,
	untracked,
} from '@angular/core';
import {
	CdkDropList,
	CdkDrag,
	CdkDragPlaceholder,
	type CdkDragDrop,
	moveItemInArray,
} from '@angular/cdk/drag-drop';
import type { Field, BlockConfig } from '@momentumcms/core';
import { humanizeFieldName } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form/entity-form.types';
import {
	getFieldNodeState,
	getFieldDefaultValue,
	isRecord,
	normalizeBlockDefaults,
} from '../entity-form/entity-form.types';
import type { BlockItem, VisualEditorState } from './visual-editor.types';
import { BlockWrapperComponent } from './block-wrapper.component';
import { BlockInserterComponent } from './block-inserter.component';

@Component({
	selector: 'mcms-visual-block-editor',
	imports: [
		CdkDropList,
		CdkDrag,
		CdkDragPlaceholder,
		forwardRef(() => BlockWrapperComponent),
		BlockInserterComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"visual-block-editor"',
		'(keydown)': 'onKeydown($event)',
	},
	template: `
		<!-- Header -->
		<div class="mb-4">
			<h3 class="text-sm font-medium text-foreground">{{ label() }}</h3>
			@if (description()) {
				<p class="text-sm text-muted-foreground mt-1">{{ description() }}</p>
			}
		</div>

		<!-- Block list with drag-drop -->
		@if (blocks().length === 0 && !isDisabled()) {
			<!-- Empty state with single inserter -->
			<div class="rounded-lg border-2 border-dashed border-border p-8 text-center">
				<p class="text-sm text-muted-foreground mb-3">No content blocks yet.</p>
				<mcms-block-inserter
					[insertIndex]="0"
					[blockDefinitions]="blockDefinitions()"
					[disabled]="isDisabled()"
					(blockTypeSelected)="addBlock($event.blockType, $event.atIndex)"
				/>
			</div>
		} @else {
			<div
				cdkDropList
				(cdkDropListDropped)="onDrop($event)"
				[cdkDropListDisabled]="isDisabled()"
				class="space-y-0"
				role="list"
				[attr.aria-label]="label() + ' blocks'"
			>
				<!-- Inserter before first block -->
				@if (!isDisabled()) {
					<mcms-block-inserter
						[insertIndex]="0"
						[blockDefinitions]="blockDefinitions()"
						(blockTypeSelected)="addBlock($event.blockType, $event.atIndex)"
					/>
				}

				@for (block of blocks(); track $index; let i = $index) {
					<!-- Block with drag handle -->
					<div cdkDrag [cdkDragDisabled]="isDisabled()">
						<!-- Drag preview placeholder -->
						<div
							*cdkDragPlaceholder
							class="rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 h-16"
						></div>

						<!-- Block content with integrated header and controls -->
						<mcms-block-wrapper
							[block]="block"
							[blockIndex]="i"
							[blockConfig]="getBlockConfig(block.blockType)"
							[blockLabel]="getBlockLabel(block.blockType)"
							[isSelected]="editorState.selectedBlockIndex() === i"
							[isHovered]="editorState.hoveredBlockIndex() === i"
							[isCollapsed]="isBlockCollapsed(i)"
							[isDisabled]="isDisabled()"
							[canMoveUp]="i > 0"
							[canMoveDown]="i < blocks().length - 1"
							[canDelete]="canRemoveBlock()"
							[formNode]="formNode()"
							[formTree]="formTree()"
							[formModel]="formModel()"
							[mode]="mode()"
							[path]="path()"
							(selected)="selectBlock(i)"
							(hoverStart)="editorState.hoveredBlockIndex.set(i)"
							(hoverEnd)="editorState.hoveredBlockIndex.set(null)"
							(moveUp)="moveBlock(i, i - 1)"
							(moveDown)="moveBlock(i, i + 1)"
							(deleteBlock)="removeBlock(i)"
							(toggleCollapse)="toggleBlockCollapse(i)"
						/>
					</div>

					<!-- Inserter after each block -->
					@if (!isDisabled()) {
						<mcms-block-inserter
							[insertIndex]="i + 1"
							[blockDefinitions]="blockDefinitions()"
							(blockTypeSelected)="addBlock($event.blockType, $event.atIndex)"
						/>
					}
				}
			</div>
		}

		<!-- Block count -->
		<div class="mt-2 text-xs text-muted-foreground text-right">
			{{ blocks().length }}{{ maxRows() ? ' / ' + maxRows() : '' }} blocks
		</div>
	`,
})
export class VisualBlockEditorComponent {
	/** Field definition (must be a BlocksField) */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this blocks array */
	readonly formNode = input<unknown>(null);

	/** Root signal forms FieldTree */
	readonly formTree = input<unknown>(null);

	/** Form model data */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Editor state */
	readonly editorState: VisualEditorState = {
		selectedBlockIndex: signal(null),
		hoveredBlockIndex: signal(null),
		inserterOpen: signal(null),
		collapsedBlocks: signal(new Set<number>()),
	};

	/** Bridge: extract FieldState from formNode */
	private readonly nodeState = computed(() => getFieldNodeState(this.formNode()));

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

	/** Computed description */
	readonly description = computed(() => this.field().description || '');

	/** Block type definitions from the field */
	readonly blockDefinitions = computed((): BlockConfig[] => {
		const f = this.field();
		if (f.type === 'blocks') {
			return f.blocks;
		}
		return [];
	});

	readonly minRows = computed((): number => {
		const f = this.field();
		return f.type === 'blocks' ? (f.minRows ?? 0) : 0;
	});

	readonly maxRows = computed((): number | undefined => {
		const f = this.field();
		return f.type === 'blocks' ? f.maxRows : undefined;
	});

	/** Current blocks as typed items */
	readonly blocks = computed((): BlockItem[] => {
		const state = this.nodeState();
		if (!state) return [];
		const val = state.value();
		if (Array.isArray(val)) {
			return val.filter(
				(item): item is BlockItem => isRecord(item) && typeof item['blockType'] === 'string',
			);
		}
		return [];
	});

	readonly isDisabled = computed(() => this.mode() === 'view');

	/**
	 * Normalize loaded blocks: ensure every block has defaults for all fields
	 * defined in its block definition. This is needed because blocks saved before
	 * a new field was added (e.g. _analytics) won't have those keys, and the
	 * signal-forms tree only creates controls for keys present in the model.
	 */
	private readonly _normalizeBlocks = effect(() => {
		const state = this.nodeState();
		if (!state) return;
		const val = state.value();
		if (!Array.isArray(val)) return;

		const { normalized, changed } = normalizeBlockDefaults(val, this.blockDefMap());
		if (changed) {
			untracked(() => state.value.set(normalized));
		}
	});

	readonly canRemoveBlock = computed((): boolean => {
		if (this.isDisabled()) return false;
		return this.blocks().length > this.minRows();
	});

	/** Block definition lookup cache */
	private readonly blockDefMap = computed((): Map<string, BlockConfig> => {
		const map = new Map<string, BlockConfig>();
		for (const def of this.blockDefinitions()) {
			map.set(def.slug, def);
		}
		return map;
	});

	/** Fallback empty block config for unknown types */
	private readonly emptyBlockConfig: BlockConfig = { slug: 'unknown', fields: [] };

	getBlockLabel(blockType: string): string {
		const def = this.blockDefMap().get(blockType);
		return def?.labels?.singular || blockType;
	}

	getBlockConfig(blockType: string): BlockConfig {
		return this.blockDefMap().get(blockType) ?? this.emptyBlockConfig;
	}

	// ── Collapse Management ──

	isBlockCollapsed(index: number): boolean {
		return this.editorState.collapsedBlocks().has(index);
	}

	toggleBlockCollapse(index: number): void {
		const current = this.editorState.collapsedBlocks();
		const next = new Set(current);
		if (next.has(index)) {
			next.delete(index);
		} else {
			next.add(index);
		}
		this.editorState.collapsedBlocks.set(next);
	}

	/** Shift collapsed indices after a block is added at atIndex */
	private shiftCollapsedUp(atIndex: number): void {
		const current = this.editorState.collapsedBlocks();
		const next = new Set<number>();
		for (const idx of current) {
			next.add(idx >= atIndex ? idx + 1 : idx);
		}
		this.editorState.collapsedBlocks.set(next);
	}

	/** Shift collapsed indices after a block is removed at removedIndex */
	private shiftCollapsedDown(removedIndex: number): void {
		const current = this.editorState.collapsedBlocks();
		const next = new Set<number>();
		for (const idx of current) {
			if (idx === removedIndex) continue;
			next.add(idx > removedIndex ? idx - 1 : idx);
		}
		this.editorState.collapsedBlocks.set(next);
	}

	/** Swap collapsed state between two indices */
	private swapCollapsed(from: number, to: number): void {
		const current = this.editorState.collapsedBlocks();
		const fromCollapsed = current.has(from);
		const toCollapsed = current.has(to);
		const next = new Set(current);
		if (fromCollapsed) {
			next.delete(from);
			next.add(to);
		} else {
			next.delete(to);
		}
		if (toCollapsed) {
			next.add(from);
		} else {
			next.delete(from);
		}
		this.editorState.collapsedBlocks.set(next);
	}

	// ── Block Operations ──

	addBlock(blockType: string, atIndex: number): void {
		const def = this.blockDefMap().get(blockType);
		if (!def) return;
		const state = this.nodeState();
		if (!state) return;

		const newBlock: BlockItem = { blockType };
		for (const field of def.fields) {
			newBlock[field.name] = getFieldDefaultValue(field);
		}

		const blocks = [...this.blocks()];
		blocks.splice(atIndex, 0, newBlock);
		this.shiftCollapsedUp(atIndex);
		state.value.set(blocks);

		// Select the new block
		this.editorState.selectedBlockIndex.set(atIndex);
	}

	removeBlock(index: number): void {
		const state = this.nodeState();
		if (!state) return;
		const blocks = this.blocks().filter((_, i) => i !== index);
		this.shiftCollapsedDown(index);
		state.value.set(blocks);

		// Adjust selection
		const selected = this.editorState.selectedBlockIndex();
		if (selected === index) {
			this.editorState.selectedBlockIndex.set(
				blocks.length > 0 ? Math.min(index, blocks.length - 1) : null,
			);
		} else if (selected !== null && selected > index) {
			this.editorState.selectedBlockIndex.set(selected - 1);
		}
	}

	moveBlock(from: number, to: number): void {
		const state = this.nodeState();
		if (!state) return;
		if (to < 0 || to >= this.blocks().length) return;
		const blocks = [...this.blocks()];
		moveItemInArray(blocks, from, to);
		this.swapCollapsed(from, to);
		state.value.set(blocks);
		this.editorState.selectedBlockIndex.set(to);
	}

	selectBlock(index: number): void {
		this.editorState.selectedBlockIndex.set(index);
	}

	onDrop(event: CdkDragDrop<unknown>): void {
		this.moveBlock(event.previousIndex, event.currentIndex);
	}

	// ── Keyboard Navigation ──

	onKeydown(event: KeyboardEvent): void {
		const selected = this.editorState.selectedBlockIndex();

		// Don't handle navigation when focused on form inputs
		const target = event.target;
		if (target instanceof HTMLElement) {
			const tagName = target.tagName.toLowerCase();
			if (
				target.isContentEditable ||
				tagName === 'input' ||
				tagName === 'textarea' ||
				tagName === 'select' ||
				target.closest('[role="textbox"]')
			) {
				return;
			}
		}

		switch (event.key) {
			case 'ArrowUp':
				if (selected !== null && selected > 0) {
					event.preventDefault();
					this.editorState.selectedBlockIndex.set(selected - 1);
				}
				break;
			case 'ArrowDown':
				if (selected !== null && selected < this.blocks().length - 1) {
					event.preventDefault();
					this.editorState.selectedBlockIndex.set(selected + 1);
				}
				break;
			case 'Escape':
				this.editorState.selectedBlockIndex.set(null);
				break;
			case 'Delete':
			case 'Backspace':
				if (selected !== null && this.canRemoveBlock()) {
					event.preventDefault();
					this.removeBlock(selected);
				}
				break;
		}
	}
}

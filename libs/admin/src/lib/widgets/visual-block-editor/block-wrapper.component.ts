/**
 * Block Wrapper Component
 *
 * Wraps each block with a header bar (block type label, collapse toggle,
 * move/delete controls) and renders form field editors for all fields
 * using the standard FieldRenderer.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroChevronUp,
	heroChevronDown,
	heroChevronRight,
	heroTrash,
} from '@ng-icons/heroicons/outline';
import type { BlockConfig, Field } from '@momentumcms/core';
import { getSubNode } from '../entity-form/entity-form.types';
import type { EntityFormMode } from '../entity-form/entity-form.types';
import type { BlockItem } from './visual-editor.types';
import { FieldRenderer } from '../entity-form/field-renderers/field-renderer.component';

@Component({
	selector: 'mcms-block-wrapper',
	imports: [FieldRenderer, NgIcon],
	providers: [provideIcons({ heroChevronUp, heroChevronDown, heroChevronRight, heroTrash })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block relative rounded-[var(--mcms-radius)] border bg-background transition-colors',
		'[class.border-ring]': 'isSelected()',
		'[class.border-border]': '!isSelected()',
		'[class.shadow-mcms-sm]': 'isSelected()',
		'[attr.data-testid]': '"block-wrapper"',
		'[attr.data-block-index]': 'blockIndex()',
		'[attr.data-block-type]': 'block().blockType',
		'[attr.role]': '"listitem"',
		'[attr.tabindex]': '"0"',
		'[attr.aria-label]': 'blockAriaLabel()',
		'(click)': 'selected.emit()',
		'(mouseenter)': 'hoverStart.emit()',
		'(mouseleave)': 'hoverEnd.emit()',
		'(focus)': 'selected.emit()',
	},
	template: `
		<!-- Block bar — flush hairline below, no muted bg. The block-type label is an
		     editorial eyebrow with a position number; controls sit inline. -->
		<!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
		<div
			class="flex items-center gap-2.5 px-3 py-2 border-b border-border"
			data-testid="block-header"
			(click)="$event.stopPropagation()"
		>
			<button
				type="button"
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				(click)="toggleCollapse.emit(); $event.stopPropagation()"
				[attr.aria-label]="isCollapsed() ? 'Expand block' : 'Collapse block'"
				[attr.aria-expanded]="!isCollapsed()"
				data-testid="block-collapse-toggle"
			>
				<ng-icon
					[name]="isCollapsed() ? 'heroChevronRight' : 'heroChevronDown'"
					size="13"
					aria-hidden="true"
				/>
			</button>

			<span class="mcms-eyebrow" data-testid="block-type-label">{{ blockLabel() }}</span>
			<span class="mcms-mono text-2xs text-muted-foreground/60 tabular-nums">
				#{{ blockIndex() + 1 }}
			</span>

			<div class="flex-1"></div>

			@if (!isDisabled()) {
				<div
					class="flex items-center gap-0.5"
					role="toolbar"
					[attr.aria-label]="blockLabel() + ' block actions'"
				>
					<button
						type="button"
						class="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/70"
						[disabled]="!canMoveUp()"
						(click)="moveUp.emit(); $event.stopPropagation()"
						aria-label="Move block up"
					>
						<ng-icon name="heroChevronUp" size="13" aria-hidden="true" />
					</button>
					<button
						type="button"
						class="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/70"
						[disabled]="!canMoveDown()"
						(click)="moveDown.emit(); $event.stopPropagation()"
						aria-label="Move block down"
					>
						<ng-icon name="heroChevronDown" size="13" aria-hidden="true" />
					</button>
					<button
						type="button"
						class="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
						[disabled]="!canDelete()"
						(click)="deleteBlock.emit(); $event.stopPropagation()"
						aria-label="Delete block"
					>
						<ng-icon name="heroTrash" size="13" aria-hidden="true" />
					</button>
				</div>
			}
		</div>

		@if (!isCollapsed()) {
			<div class="px-4 py-4 flex flex-col gap-5" data-testid="block-fields">
				@for (field of visibleFields(); track field.name) {
					<mcms-field-renderer
						[field]="field"
						[formNode]="getBlockSubNode(field.name)"
						[formTree]="formTree()"
						[formModel]="formModel()"
						[mode]="mode()"
						[path]="getBlockSubFieldPath(field.name)"
					/>
				}
			</div>
		}
	`,
})
export class BlockWrapperComponent {
	/** The block data */
	readonly block = input.required<BlockItem>();

	/** Block index in the blocks array */
	readonly blockIndex = input.required<number>();

	/** Block type configuration */
	readonly blockConfig = input.required<BlockConfig>();

	/** Human-readable block type label */
	readonly blockLabel = input.required<string>();

	/** Whether this block is currently selected */
	readonly isSelected = input(false);

	/** Whether this block is currently hovered */
	readonly isHovered = input(false);

	/** Whether the editor is in view/disabled mode */
	readonly isDisabled = input(false);

	/** Whether this block is collapsed (fields hidden) */
	readonly isCollapsed = input(false);

	/** Whether the block can be moved up */
	readonly canMoveUp = input(true);

	/** Whether the block can be moved down */
	readonly canMoveDown = input(true);

	/** Whether the block can be deleted */
	readonly canDelete = input(true);

	/** Signal forms node for the blocks array */
	readonly formNode = input<unknown>(null);

	/** Root signal forms FieldTree */
	readonly formTree = input<unknown>(null);

	/** Form model data */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('edit');

	/** Field path prefix (e.g., "content") */
	readonly path = input('');

	/** Emitted when the block is clicked/focused */
	readonly selected = output<void>();

	/** Emitted when the mouse enters */
	readonly hoverStart = output<void>();

	/** Emitted when the mouse leaves */
	readonly hoverEnd = output<void>();

	/** Emitted when the move up button is clicked */
	readonly moveUp = output<void>();

	/** Emitted when the move down button is clicked */
	readonly moveDown = output<void>();

	/** Emitted when the delete button is clicked */
	readonly deleteBlock = output<void>();

	/** Emitted when the collapse toggle is clicked */
	readonly toggleCollapse = output<void>();

	/** Visible fields (not hidden by admin config) */
	readonly visibleFields = computed((): Field[] => {
		return this.blockConfig().fields.filter((f) => !f.admin?.hidden);
	});

	readonly blockAriaLabel = computed((): string => {
		const label = this.blockLabel();
		return `${label} block, position ${this.blockIndex() + 1}`;
	});

	/** Get a FieldTree sub-node for a block's sub-field */
	getBlockSubNode(fieldName: string): unknown {
		const blockNode = getSubNode(this.formNode(), this.blockIndex());
		return getSubNode(blockNode, fieldName);
	}

	/** Get the full path for a block's sub-field */
	getBlockSubFieldPath(fieldName: string): string {
		return `${this.path()}.${this.blockIndex()}.${fieldName}`;
	}
}

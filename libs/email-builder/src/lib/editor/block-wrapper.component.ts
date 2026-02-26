import {
	Component,
	ChangeDetectionStrategy,
	input,
	output,
	computed,
	inject,
	ViewContainerRef,
	viewChild,
	effect,
	signal,
	type Type,
} from '@angular/core';
import type { EmailBlock } from '@momentumcms/email';
import { EmailBuilderStateService } from '../services/email-builder-state.service';
import { BLOCK_EDITOR_MAP } from './block-editors/index';

@Component({
	selector: 'eml-block-wrapper',
	host: {
		class: 'eml-block-wrapper',
		'data-testid': 'eml-block-wrapper',
		'[attr.data-block-type]': 'block().type',
		'[class.eml-block-wrapper--selected]': 'isSelected()',
		'[class.eml-block-wrapper--hovered]': 'isHovered()',
		'[class.eml-block-wrapper--collapsed]': 'collapsed()',
		'(click)': 'onSelect($event)',
		'(mouseenter)': 'state.hoveredBlockId.set(block().id)',
		'(mouseleave)': 'state.hoveredBlockId.set(null)',
	},
	template: `
		<div class="eml-block-header">
			<button
				type="button"
				class="eml-block-collapse-toggle"
				data-testid="block-collapse-toggle"
				[attr.aria-label]="collapsed() ? 'Expand block' : 'Collapse block'"
				[attr.aria-expanded]="!collapsed()"
				(click)="toggleCollapse($event)"
			>
				<span class="eml-collapse-icon" [class.eml-collapse-icon--open]="!collapsed()"
					>&#x25B6;</span
				>
			</button>
			<span class="eml-block-type-badge">{{ block().type }}</span>
			<div class="eml-block-actions">
				<button
					type="button"
					class="eml-block-action"
					data-testid="block-move-up"
					title="Move up"
					[disabled]="isFirst()"
					(click)="moveUp.emit(); $event.stopPropagation()"
				>
					&#x2191;
				</button>
				<button
					type="button"
					class="eml-block-action"
					data-testid="block-move-down"
					title="Move down"
					[disabled]="isLast()"
					(click)="moveDown.emit(); $event.stopPropagation()"
				>
					&#x2193;
				</button>
				<button
					type="button"
					class="eml-block-action"
					data-testid="block-duplicate"
					title="Duplicate"
					(click)="duplicate.emit(); $event.stopPropagation()"
				>
					&#x2398;
				</button>
				<button
					type="button"
					class="eml-block-action eml-block-action--danger"
					data-testid="block-delete"
					title="Delete"
					(click)="remove.emit(); $event.stopPropagation()"
				>
					&#x2715;
				</button>
			</div>
		</div>
		@if (!collapsed() && isSelected()) {
			<div class="eml-block-editor-container" data-testid="block-editor-container">
				<ng-container #editorOutlet />
			</div>
		}
	`,
	styles: `
		:host {
			display: block;
			border-radius: 8px;
			border: 1px solid hsl(var(--mcms-border));
			background: hsl(var(--mcms-card));
			transition:
				border-color 0.15s,
				box-shadow 0.15s;
		}

		:host(.eml-block-wrapper--hovered) {
			border-color: hsl(var(--mcms-primary) / 0.4);
		}

		:host(.eml-block-wrapper--selected) {
			border-color: hsl(var(--mcms-primary));
			box-shadow: 0 0 0 2px hsl(var(--mcms-primary) / 0.15);
		}

		:host(.eml-block-wrapper--collapsed) {
			opacity: 0.85;
		}

		:host(.eml-block-wrapper--collapsed:hover) {
			opacity: 1;
		}

		.eml-block-header {
			display: flex;
			align-items: center;
			padding: 8px 12px;
			gap: 8px;
		}

		.eml-block-collapse-toggle {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 24px;
			border-radius: 4px;
			border: none;
			background: transparent;
			color: hsl(var(--mcms-muted-foreground));
			font-size: 10px;
			cursor: pointer;
			transition:
				background-color 0.15s,
				color 0.15s;
			flex-shrink: 0;
		}

		.eml-block-collapse-toggle:hover {
			background: hsl(var(--mcms-muted));
			color: hsl(var(--mcms-foreground));
		}

		.eml-collapse-icon {
			display: inline-block;
			transition: transform 0.15s ease;
		}

		.eml-collapse-icon--open {
			transform: rotate(90deg);
		}

		.eml-block-type-badge {
			font-size: 11px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: hsl(var(--mcms-muted-foreground));
			background: hsl(var(--mcms-muted));
			padding: 2px 8px;
			border-radius: 4px;
		}

		.eml-block-actions {
			display: flex;
			gap: 2px;
			opacity: 0;
			transition: opacity 0.15s;
			margin-left: auto;
		}

		:host(:hover) .eml-block-actions,
		:host(.eml-block-wrapper--selected) .eml-block-actions {
			opacity: 1;
		}

		.eml-block-action {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			border-radius: 6px;
			border: none;
			background: transparent;
			color: hsl(var(--mcms-muted-foreground));
			font-size: 14px;
			cursor: pointer;
			transition:
				background-color 0.15s,
				color 0.15s;
		}

		.eml-block-action:hover {
			background: hsl(var(--mcms-muted));
			color: hsl(var(--mcms-foreground));
		}

		.eml-block-action:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}

		.eml-block-action:disabled:hover {
			background: transparent;
			color: hsl(var(--mcms-muted-foreground));
		}

		.eml-block-action--danger:hover {
			background: hsl(var(--mcms-destructive) / 0.1);
			color: hsl(var(--mcms-destructive));
		}

		.eml-block-editor-container {
			border-top: 1px solid hsl(var(--mcms-border));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockWrapperComponent {
	readonly state = inject(EmailBuilderStateService);
	private readonly editorOutlet = viewChild('editorOutlet', { read: ViewContainerRef });

	readonly block = input.required<EmailBlock>();
	readonly blockIndex = input.required<number>();
	readonly totalBlocks = input.required<number>();

	readonly moveUp = output<void>();
	readonly moveDown = output<void>();
	readonly duplicate = output<void>();
	readonly remove = output<void>();

	readonly collapsed = signal(false);

	readonly isFirst = computed(() => this.blockIndex() === 0);
	readonly isLast = computed(() => this.blockIndex() === this.totalBlocks() - 1);
	readonly isSelected = computed(() => this.state.selectedBlockId() === this.block().id);
	readonly isHovered = computed(() => this.state.hoveredBlockId() === this.block().id);

	/** Only the block type — avoids destroying the editor when block data changes */
	private readonly blockType = computed(() => this.block().type);

	constructor() {
		effect(() => {
			const vcr = this.editorOutlet();
			if (!vcr) return;

			const type = this.blockType();
			const selected = this.isSelected();

			vcr.clear();
			if (!selected) return;

			const editorType: Type<unknown> | undefined = BLOCK_EDITOR_MAP[type];
			if (editorType) {
				vcr.createComponent(editorType);
			}
		});
	}

	toggleCollapse(event: MouseEvent): void {
		event.stopPropagation();
		const wasCollapsed = this.collapsed();
		this.collapsed.update((v) => !v);
		if (wasCollapsed) {
			this.state.selectedBlockId.set(this.block().id);
		}
	}

	onSelect(event: MouseEvent): void {
		event.stopPropagation();
		if (this.collapsed()) {
			this.collapsed.set(false);
		}
		this.state.selectedBlockId.set(this.block().id);
	}
}

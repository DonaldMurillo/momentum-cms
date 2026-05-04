import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragDrop, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { EmailBuilderStateService } from '../services/email-builder-state.service';
import { BlockWrapperComponent } from './block-wrapper.component';
import { BlockInserterComponent } from './block-inserter.component';

@Component({
	selector: 'eml-editor-panel',
	imports: [
		CdkDropList,
		CdkDrag,
		CdkDragPlaceholder,
		BlockWrapperComponent,
		BlockInserterComponent,
	],
	host: {
		class: 'eml-editor-panel',
		'data-testid': 'email-editor-panel',
		'(click)': 'onPanelClick()',
	},
	template: `
		<div class="eml-block-list" cdkDropList (cdkDropListDropped)="onDrop($event)">
			<eml-block-inserter [insertIndex]="0" />

			@for (block of state.blocks(); track block.id; let i = $index) {
				<div cdkDrag class="eml-drag-item">
					<div *cdkDragPlaceholder class="eml-drag-placeholder"></div>
					<eml-block-wrapper
						[block]="block"
						[blockIndex]="i"
						[totalBlocks]="state.blockCount()"
						(moveUp)="state.moveBlock(i, i - 1)"
						(moveDown)="state.moveBlock(i, i + 1)"
						(duplicate)="state.duplicateBlock(block.id)"
						(remove)="state.removeBlock(block.id)"
					/>
				</div>
				<eml-block-inserter [insertIndex]="i + 1" />
			}

			@if (state.blockCount() === 0) {
				<div class="eml-empty-state">
					<p class="mcms-eyebrow mb-2">Empty canvas</p>
					<p>Pick a starter block above to begin composing your email.</p>
				</div>
			}
		</div>
	`,
	styles: `
		:host {
			display: block;
			padding: 24px;
			color: hsl(var(--mcms-card-foreground));
		}

		.eml-block-list {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-height: 200px;
		}

		.eml-drag-item {
			cursor: grab;
		}

		.eml-drag-item:active {
			cursor: grabbing;
		}

		/* Drag placeholder — soft brand tint, no aggressive dashed border */
		.eml-drag-placeholder {
			height: 48px;
			border-radius: var(--mcms-radius);
			background: hsl(var(--mcms-primary) / 0.06);
			transition: all 0.2s;
		}

		/* Empty canvas — quiet typography, hairline border-y instead of dashed box */
		.eml-empty-state {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-height: 200px;
			padding: 2.5rem 1rem;
			border-top: 1px solid hsl(var(--mcms-border));
			border-bottom: 1px solid hsl(var(--mcms-border));
			color: hsl(var(--mcms-muted-foreground));
			font-size: 13px;
			text-align: center;
		}

		.cdk-drag-animating {
			transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
		}

		.cdk-drop-list-dragging .eml-drag-item:not(.cdk-drag-placeholder) {
			transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailEditorPanelComponent {
	readonly state = inject(EmailBuilderStateService);

	onDrop(event: CdkDragDrop<unknown>): void {
		this.state.moveBlock(event.previousIndex, event.currentIndex);
	}

	onPanelClick(): void {
		this.state.clearSelection();
	}
}

import { Component, ChangeDetectionStrategy, inject, input, output, effect } from '@angular/core';
import type { EmailBlock, EmailTheme } from '@momentumcms/email';
import { EmailBuilderStateService } from './services/email-builder-state.service';
import { EmailEditorPanelComponent } from './editor/email-editor-panel.component';
import { EmailPreviewPanelComponent } from './preview/email-preview-panel.component';

/**
 * Default email builder component — split-view editor + live preview.
 *
 * @example
 * ```html
 * <eml-builder
 *   [blocks]="emailBlocks"
 *   [theme]="emailTheme"
 *   (blocksChange)="onBlocksChange($event)"
 * />
 * ```
 */
@Component({
	selector: 'eml-builder',
	imports: [EmailEditorPanelComponent, EmailPreviewPanelComponent],
	host: { class: 'eml-builder', 'data-testid': 'email-builder' },
	template: `
		<eml-editor-panel />
		<eml-preview-panel />
	`,
	styles: `
		:host {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1px;
			height: 100%;
			background: hsl(var(--mcms-border));
		}

		eml-editor-panel,
		eml-preview-panel {
			background: hsl(var(--mcms-card));
			overflow-y: auto;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailBuilderComponent {
	private readonly state = inject(EmailBuilderStateService);

	/** Input blocks to load into the editor. */
	readonly blocks = input<EmailBlock[]>([]);

	/** Theme configuration for the preview. */
	readonly theme = input<EmailTheme | undefined>(undefined);

	/** Emitted when blocks change (add, remove, reorder, edit). */
	readonly blocksChange = output<EmailBlock[]>();

	constructor() {
		// Sync input → state
		effect(() => {
			this.state.setBlocks(this.blocks());
		});

		effect(() => {
			this.state.setTheme(this.theme());
		});

		// Sync state → output
		effect(() => {
			this.blocksChange.emit(this.state.blocks());
		});
	}
}

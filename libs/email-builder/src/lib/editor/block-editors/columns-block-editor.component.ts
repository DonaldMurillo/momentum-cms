import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { EmailBuilderStateService } from '../../services/email-builder-state.service';
import { EML_FORM_STYLES } from '../../styles/shared-styles';

@Component({
	selector: 'eml-columns-block-editor',
	styles: [EML_FORM_STYLES],
	template: `
		@if (state.selectedBlock(); as block) {
			<div class="eml-block-editor">
				<p class="eml-label">Columns layout</p>
				<p class="eml-help-text">
					Configure nested blocks within each column using the visual editor.
				</p>
			</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnsBlockEditorComponent {
	readonly state = inject(EmailBuilderStateService);
}

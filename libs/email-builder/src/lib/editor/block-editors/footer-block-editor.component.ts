import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmailBuilderStateService } from '../../services/email-builder-state.service';
import { EML_FORM_STYLES } from '../../styles/shared-styles';

@Component({
	selector: 'eml-footer-block-editor',
	imports: [FormsModule],
	styles: [EML_FORM_STYLES],
	template: `
		@if (state.selectedBlock(); as block) {
			<div class="eml-block-editor">
				<label class="eml-field">
					<span class="eml-label">Footer Text</span>
					<textarea
						class="eml-input eml-textarea"
						rows="3"
						[ngModel]="block.data['text']"
						(ngModelChange)="update('text', $event)"
					></textarea>
				</label>
				<label class="eml-field">
					<span class="eml-label">Text Color</span>
					<input
						type="color"
						class="eml-input-color"
						[ngModel]="block.data['color'] ?? '#71717a'"
						(ngModelChange)="update('color', $event)"
					/>
				</label>
			</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterBlockEditorComponent {
	readonly state = inject(EmailBuilderStateService);

	update(key: string, value: unknown): void {
		const block = this.state.selectedBlock();
		if (block) {
			this.state.updateBlockData(block.id, { [key]: value });
		}
	}
}

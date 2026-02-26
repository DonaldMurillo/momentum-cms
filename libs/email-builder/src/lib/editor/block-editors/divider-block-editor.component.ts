import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmailBuilderStateService } from '../../services/email-builder-state.service';
import { EML_FORM_STYLES } from '../../styles/shared-styles';

@Component({
	selector: 'eml-divider-block-editor',
	imports: [FormsModule],
	styles: [EML_FORM_STYLES],
	template: `
		@if (state.selectedBlock(); as block) {
			<div class="eml-block-editor">
				<label class="eml-field">
					<span class="eml-label">Color</span>
					<input
						type="color"
						class="eml-input-color"
						[ngModel]="block.data['color'] ?? '#e4e4e7'"
						(ngModelChange)="update('color', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Margin</span>
					<input
						type="text"
						class="eml-input"
						[ngModel]="block.data['margin'] ?? '24px 0'"
						(ngModelChange)="update('margin', $event)"
					/>
				</label>
			</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DividerBlockEditorComponent {
	readonly state = inject(EmailBuilderStateService);

	update(key: string, value: unknown): void {
		const block = this.state.selectedBlock();
		if (block) {
			this.state.updateBlockData(block.id, { [key]: value });
		}
	}
}

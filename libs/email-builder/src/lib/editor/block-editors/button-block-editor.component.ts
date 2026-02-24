import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmailBuilderStateService } from '../../services/email-builder-state.service';
import { EML_FORM_STYLES } from '../../styles/shared-styles';

@Component({
	selector: 'eml-button-block-editor',
	imports: [FormsModule],
	styles: [EML_FORM_STYLES],
	template: `
		@if (state.selectedBlock(); as block) {
			<div class="eml-block-editor">
				<label class="eml-field">
					<span class="eml-label">Label</span>
					<input
						type="text"
						class="eml-input"
						[ngModel]="block.data['label']"
						(ngModelChange)="update('label', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">URL</span>
					<input
						type="url"
						class="eml-input"
						[ngModel]="block.data['href']"
						(ngModelChange)="update('href', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Background Color</span>
					<input
						type="color"
						class="eml-input-color"
						[ngModel]="block.data['backgroundColor'] ?? '#18181b'"
						(ngModelChange)="update('backgroundColor', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Text Color</span>
					<input
						type="color"
						class="eml-input-color"
						[ngModel]="block.data['color'] ?? '#ffffff'"
						(ngModelChange)="update('color', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Alignment</span>
					<select
						class="eml-input"
						[ngModel]="block.data['alignment'] ?? 'left'"
						(ngModelChange)="update('alignment', $event)"
					>
						<option value="left">Left</option>
						<option value="center">Center</option>
						<option value="right">Right</option>
					</select>
				</label>
			</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonBlockEditorComponent {
	readonly state = inject(EmailBuilderStateService);

	update(key: string, value: unknown): void {
		const block = this.state.selectedBlock();
		if (block) {
			this.state.updateBlockData(block.id, { [key]: value });
		}
	}
}

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmailBuilderStateService } from '../../services/email-builder-state.service';
import { EML_FORM_STYLES } from '../../styles/shared-styles';

@Component({
	selector: 'eml-header-block-editor',
	imports: [FormsModule],
	styles: [EML_FORM_STYLES],
	template: `
		@if (state.selectedBlock(); as block) {
			<div class="eml-block-editor">
				<label class="eml-field">
					<span class="eml-label">Title</span>
					<input
						type="text"
						class="eml-input"
						[ngModel]="block.data['title']"
						(ngModelChange)="update('title', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Subtitle</span>
					<input
						type="text"
						class="eml-input"
						[ngModel]="block.data['subtitle']"
						(ngModelChange)="update('subtitle', $event)"
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
export class HeaderBlockEditorComponent {
	readonly state = inject(EmailBuilderStateService);

	update(key: string, value: unknown): void {
		const block = this.state.selectedBlock();
		if (block) {
			this.state.updateBlockData(block.id, { [key]: value });
		}
	}
}

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmailBuilderStateService } from '../../services/email-builder-state.service';
import { EML_FORM_STYLES } from '../../styles/shared-styles';

@Component({
	selector: 'eml-image-block-editor',
	imports: [FormsModule],
	styles: [EML_FORM_STYLES],
	template: `
		@if (state.selectedBlock(); as block) {
			<div class="eml-block-editor">
				<label class="eml-field">
					<span class="eml-label">Image URL</span>
					<input
						type="url"
						class="eml-input"
						[ngModel]="block.data['src']"
						(ngModelChange)="update('src', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Alt Text</span>
					<input
						type="text"
						class="eml-input"
						[ngModel]="block.data['alt']"
						(ngModelChange)="update('alt', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Width</span>
					<input
						type="text"
						class="eml-input"
						[ngModel]="block.data['width'] ?? '100%'"
						(ngModelChange)="update('width', $event)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Link URL (optional)</span>
					<input
						type="url"
						class="eml-input"
						[ngModel]="block.data['href']"
						(ngModelChange)="update('href', $event)"
					/>
				</label>
			</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageBlockEditorComponent {
	readonly state = inject(EmailBuilderStateService);

	update(key: string, value: unknown): void {
		const block = this.state.selectedBlock();
		if (block) {
			this.state.updateBlockData(block.id, { [key]: value });
		}
	}
}

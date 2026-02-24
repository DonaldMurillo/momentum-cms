import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	effect,
	untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmailBuilderStateService } from '../../services/email-builder-state.service';
import { EML_FORM_STYLES } from '../../styles/shared-styles';

@Component({
	selector: 'eml-text-block-editor',
	imports: [FormsModule],
	styles: [EML_FORM_STYLES],
	template: `
		@if (state.selectedBlock(); as block) {
			<div class="eml-block-editor">
				<label class="eml-field">
					<span class="eml-label">Content</span>
					<textarea
						class="eml-input eml-textarea"
						rows="4"
						[ngModel]="block.data['content']"
						(ngModelChange)="update('content', $event)"
					></textarea>
				</label>
				<label class="eml-field">
					<span class="eml-label">Font Size (px)</span>
					<input
						#fontSizeEl
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						class="eml-input"
						data-testid="font-size-input"
						[value]="fontSizeDisplay()"
						(input)="onNumericInput('fontSize', fontSizeEl.value)"
						(blur)="onNumericBlur('fontSize', 16)"
					/>
				</label>
				<label class="eml-field">
					<span class="eml-label">Color</span>
					<input
						type="color"
						class="eml-input-color"
						[ngModel]="block.data['color'] ?? '#3f3f46'"
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
export class TextBlockEditorComponent {
	readonly state = inject(EmailBuilderStateService);

	/** Local display signal for fontSize — decoupled from block state during editing */
	readonly fontSizeDisplay = signal('');

	/** Track whether the user is actively editing the field */
	private fontSizeEditing = false;

	constructor() {
		// Sync block state → display signal (only when not actively editing)
		effect(() => {
			const block = this.state.selectedBlock();
			if (!this.fontSizeEditing) {
				untracked(() => this.fontSizeDisplay.set(String(block?.data['fontSize'] ?? 16)));
			}
		});
	}

	update(key: string, value: unknown): void {
		const block = this.state.selectedBlock();
		if (block) {
			this.state.updateBlockData(block.id, { [key]: value });
		}
	}

	onNumericInput(key: string, rawValue: string): void {
		this.fontSizeEditing = true;
		this.fontSizeDisplay.set(rawValue);

		const num = parseInt(rawValue, 10);
		if (!isNaN(num) && num > 0) {
			const block = this.state.selectedBlock();
			if (block) {
				this.state.updateBlockData(block.id, { [key]: num });
			}
		}
	}

	onNumericBlur(key: string, defaultVal: number): void {
		this.fontSizeEditing = false;
		const block = this.state.selectedBlock();
		const current = block?.data[key];
		const num = parseInt(this.fontSizeDisplay(), 10);
		if (isNaN(num) || num <= 0) {
			// Revert to current state value or default
			const revert = typeof current === 'number' ? current : defaultVal;
			this.fontSizeDisplay.set(String(revert));
		} else {
			this.fontSizeDisplay.set(String(current ?? defaultVal));
		}
	}
}

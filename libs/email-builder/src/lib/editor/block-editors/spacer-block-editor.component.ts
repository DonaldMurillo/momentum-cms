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
	selector: 'eml-spacer-block-editor',
	imports: [FormsModule],
	styles: [EML_FORM_STYLES],
	template: `
		@if (state.selectedBlock(); as block) {
			<div class="eml-block-editor">
				<label class="eml-field">
					<span class="eml-label">Height (px)</span>
					<input
						#heightEl
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						class="eml-input"
						data-testid="spacer-height-input"
						[value]="heightDisplay()"
						(input)="onNumericInput('height', heightEl.value)"
						(blur)="onNumericBlur('height', 24)"
					/>
				</label>
			</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpacerBlockEditorComponent {
	readonly state = inject(EmailBuilderStateService);

	/** Local display signal for height — decoupled from block state during editing */
	readonly heightDisplay = signal('');

	/** Track whether the user is actively editing the field */
	private heightEditing = false;

	constructor() {
		// Sync block state → display signal (only when not actively editing)
		effect(() => {
			const block = this.state.selectedBlock();
			if (!this.heightEditing) {
				untracked(() => this.heightDisplay.set(String(block?.data['height'] ?? 24)));
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
		this.heightEditing = true;
		this.heightDisplay.set(rawValue);

		const num = parseInt(rawValue, 10);
		if (!isNaN(num) && num > 0) {
			const block = this.state.selectedBlock();
			if (block) {
				this.state.updateBlockData(block.id, { [key]: num });
			}
		}
	}

	onNumericBlur(key: string, defaultVal: number): void {
		this.heightEditing = false;
		const block = this.state.selectedBlock();
		const current = block?.data[key];
		const num = parseInt(this.heightDisplay(), 10);
		if (isNaN(num) || num <= 0) {
			// Revert to current state value or default
			const revert = typeof current === 'number' ? current : defaultVal;
			this.heightDisplay.set(String(revert));
		} else {
			this.heightDisplay.set(String(current ?? defaultVal));
		}
	}
}

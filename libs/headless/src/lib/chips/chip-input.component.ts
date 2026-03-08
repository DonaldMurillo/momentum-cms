import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from '@angular/core';
import { HdlChips } from './chips.component';

@Component({
	selector: 'input[hdl-chip-input]',
	host: {
		'[attr.data-slot]': '"chip-input"',
		'[attr.data-disabled]': 'chips.disabled() ? "true" : null',
		'[disabled]': 'chips.disabled()',
		'(keydown)': 'handleKeydown($event)',
		'(blur)': 'commitOnBlur()',
	},
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlChipInput {
	private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
	readonly chips = inject(HdlChips);
	readonly addOnBlur = input(false);

	handleKeydown(event: KeyboardEvent): void {
		if (this.chips.disabled()) {
			return;
		}

		const input = this.elementRef.nativeElement;
		if (event.key === 'Backspace' && input.value === '') {
			this.chips.removeLastValue();
			return;
		}

		if (this.chips.isSeparatorKey(event.key)) {
			event.preventDefault();
			if (this.chips.addValue(input.value)) {
				input.value = '';
			}
		}
	}

	commitOnBlur(): void {
		if (!this.addOnBlur() || this.chips.disabled()) {
			return;
		}

		const input = this.elementRef.nativeElement;
		if (this.chips.addValue(input.value)) {
			input.value = '';
		}
	}
}

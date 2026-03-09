import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { HdlRadioGroup } from './radio-group.component';

@Component({
	selector: 'hdl-radio-item',
	host: {
		'[attr.data-slot]': '"radio-item"',
		'[attr.data-state]': 'isSelected() ? "checked" : "unchecked"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		role: 'radio',
		'[attr.aria-checked]': 'isSelected()',
		'[attr.aria-disabled]': 'disabled() || null',
		'[attr.tabindex]': 'tabIndex()',
		'(click)': 'select()',
		'(keydown.space)': 'select(); $event.preventDefault()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlRadioItem {
	private readonly radioGroup = inject(HdlRadioGroup);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
	readonly value = input.required<string>();
	readonly disabled = input(false);

	private readonly registrationEffect = effect((onCleanup) => {
		const value = this.value();
		untracked(() => this.radioGroup.registerItemValue(value));
		onCleanup(() => {
			untracked(() => this.radioGroup.unregisterItemValue(value));
		});
	});

	readonly isSelected = computed(() => this.radioGroup.value() === this.value());

	// Cannot be a computed — isInitialTabStop reads DOM via querySelectorAll
	tabIndex(): number {
		if (this.disabled() || this.radioGroup.disabled()) {
			return -1;
		}

		if (this.isSelected()) {
			return 0;
		}

		return this.radioGroup.isInitialTabStop(this.elementRef.nativeElement) ? 0 : -1;
	}

	select(): void {
		if (!this.disabled() && !this.radioGroup.disabled()) {
			this.radioGroup.value.set(this.value());
		}
	}
}

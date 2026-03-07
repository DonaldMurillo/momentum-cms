import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
	selector: 'hdl-checkbox',
	host: {
		role: 'checkbox',
		'[attr.aria-checked]': 'indeterminate() ? "mixed" : value()',
		'[attr.aria-disabled]': 'disabled() || null',
		'[attr.tabindex]': 'disabled() ? -1 : 0',
		'(click)': 'toggle()',
		'(keydown.enter)': 'toggle()',
		'(keydown.space)': 'toggle(); $event.preventDefault()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCheckbox {
	readonly value = model(false);
	readonly disabled = input(false);
	readonly indeterminate = input(false);

	toggle(): void {
		if (!this.disabled()) {
			this.value.set(!this.value());
		}
	}
}

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
	selector: 'hdl-switch',
	host: {
		'[attr.data-slot]': '"switch"',
		'[attr.data-state]': 'value() ? "checked" : "unchecked"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		role: 'switch',
		'[attr.aria-checked]': 'value()',
		'[attr.aria-disabled]': 'disabled() || null',
		'[attr.tabindex]': 'disabled() ? -1 : 0',
		'(click)': 'toggle()',
		'(keydown.enter)': 'toggle()',
		'(keydown.space)': 'toggle(); $event.preventDefault()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSwitch {
	readonly value = model(false);
	readonly disabled = input(false);

	toggle(): void {
		if (!this.disabled()) {
			this.value.set(!this.value());
		}
	}
}

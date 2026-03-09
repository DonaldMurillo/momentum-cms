import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
	selector: 'hdl-toggle',
	host: {
		'[attr.data-slot]': '"toggle"',
		'[attr.data-state]': 'pressed() ? "on" : "off"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		role: 'button',
		'[attr.tabindex]': 'disabled() ? -1 : 0',
		'[attr.aria-pressed]': 'pressed()',
		'[attr.aria-disabled]': 'disabled() || null',
		'(click)': 'toggle()',
		'(keydown.enter)': 'toggleFromKeyboard($event)',
		'(keydown.space)': 'toggleFromKeyboard($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToggle {
	readonly pressed = model(false);
	readonly disabled = input(false);

	toggle(): void {
		if (!this.disabled()) {
			this.pressed.update((value) => !value);
		}
	}

	toggleFromKeyboard(event: Event): void {
		event.preventDefault();
		this.toggle();
	}
}

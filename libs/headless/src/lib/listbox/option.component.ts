import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Option } from '@angular/aria/listbox';

@Component({
	selector: 'hdl-option',
	host: {
		'[attr.data-slot]': '"option"',
		'[attr.data-state]': 'option.selected() ? "selected" : "unselected"',
		'[attr.data-active]': 'option.active() ? "true" : null',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
	hostDirectives: [
		{
			directive: Option,
			inputs: ['value', 'label', 'disabled'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlOption {
	readonly option = inject(Option);
	readonly value = input.required<string>();
	readonly label = input<string>();
	readonly disabled = input(false);
}

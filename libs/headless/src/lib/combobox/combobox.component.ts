import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Combobox } from '@angular/aria/combobox';

@Component({
	selector: 'hdl-combobox',
	host: {
		'[attr.data-slot]': '"combobox"',
		'[attr.data-state]': 'combobox.expanded() ? "open" : "closed"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'[attr.data-readonly]': 'readonly() ? "true" : null',
	},
	hostDirectives: [
		{
			directive: Combobox,
			inputs: ['disabled', 'filterMode', 'readonly', 'alwaysExpanded'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCombobox {
	readonly combobox = inject(Combobox);
	readonly disabled = input(false);
	readonly filterMode = input<'startsWith' | 'contains'>('startsWith');
	readonly readonly = input(false);
	readonly alwaysExpanded = input(false);
}

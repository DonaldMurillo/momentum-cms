import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Combobox } from '@angular/aria/combobox';

@Component({
	selector: 'hdl-combobox',
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

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ComboboxInput } from '@angular/aria/combobox';

@Component({
	selector: 'input[hdl-combobox-input]',
	host: {
		'[attr.data-slot]': '"combobox-input"',
	},
	hostDirectives: [ComboboxInput],
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlComboboxInput {
	readonly comboboxInput = inject(ComboboxInput);
}

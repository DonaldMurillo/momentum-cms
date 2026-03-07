import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ComboboxPopup } from '@angular/aria/combobox';

@Component({
	selector: 'hdl-combobox-popup',
	hostDirectives: [ComboboxPopup],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlComboboxPopup {
	readonly comboboxPopup = inject(ComboboxPopup);
}

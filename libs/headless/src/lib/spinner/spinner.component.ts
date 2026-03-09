import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
	selector: 'hdl-spinner',
	host: {
		'[attr.data-slot]': '"spinner"',
		'[attr.data-state]': 'active() ? "active" : "inactive"',
		role: 'status',
		'[attr.aria-hidden]': 'active() ? null : "true"',
		'[attr.aria-label]': 'label()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSpinner {
	readonly active = input(true);
	readonly label = input('Loading');
}

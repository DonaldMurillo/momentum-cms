import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
	selector: 'hdl-skeleton',
	host: {
		'[attr.data-slot]': '"skeleton"',
		'[attr.data-state]': 'active() ? "active" : "inactive"',
		'[attr.aria-hidden]': '"true"',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSkeleton {
	readonly active = input(true);
}

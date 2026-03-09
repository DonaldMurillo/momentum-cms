import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'hdl-popover-content',
	host: {
		'[attr.data-slot]': '"popover-content"',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlPopoverContent {}

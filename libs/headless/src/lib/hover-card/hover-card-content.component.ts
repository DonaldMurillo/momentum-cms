import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'hdl-hover-card-content',
	host: {
		'[attr.data-slot]': '"hover-card-content"',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlHoverCardContent {}

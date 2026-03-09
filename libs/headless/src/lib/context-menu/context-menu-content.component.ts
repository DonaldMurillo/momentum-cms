import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'hdl-context-menu-content',
	host: {
		'[attr.data-slot]': '"context-menu-content"',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlContextMenuContent {}

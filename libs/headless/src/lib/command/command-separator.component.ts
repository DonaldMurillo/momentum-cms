import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'hdl-command-separator',
	host: {
		'[attr.data-slot]': '"command-separator"',
		role: 'separator',
	},
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCommandSeparator {}

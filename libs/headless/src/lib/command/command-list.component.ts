import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HdlCommand } from './command.component';

@Component({
	selector: 'hdl-command-list',
	host: {
		role: 'listbox',
		'[attr.data-slot]': '"command-list"',
		'[attr.id]': 'command.listId',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCommandList {
	protected readonly command = inject(HdlCommand);
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HdlCommand } from './command.component';

@Component({
	selector: 'hdl-command-empty',
	host: {
		'[attr.data-slot]': '"command-empty"',
		'[attr.hidden]': 'command.queryVisibleItemCount() === 0 ? null : ""',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCommandEmpty {
	protected readonly command = inject(HdlCommand);
}

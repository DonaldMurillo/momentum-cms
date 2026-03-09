import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { HdlAlertDialog } from './alert-dialog.component';

let nextId = 0;

@Component({
	selector: 'hdl-alert-dialog-title',
	host: {
		'[attr.data-slot]': '"alert-dialog-title"',
		'[attr.id]': 'id()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlAlertDialogTitle {
	private readonly dialog = inject(HdlAlertDialog);
	readonly id = input(`hdl-alert-dialog-title-${nextId++}`);

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id();
		untracked(() => this.dialog.registerTitle(id));
		onCleanup(() => {
			untracked(() => this.dialog.unregisterTitle(id));
		});
	});
}

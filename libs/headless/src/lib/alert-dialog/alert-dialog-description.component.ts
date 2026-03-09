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
	selector: 'hdl-alert-dialog-description',
	host: {
		'[attr.data-slot]': '"alert-dialog-description"',
		'[attr.id]': 'id()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlAlertDialogDescription {
	private readonly dialog = inject(HdlAlertDialog);
	readonly id = input(`hdl-alert-dialog-description-${nextId++}`);

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id();
		untracked(() => this.dialog.registerDescription(id));
		onCleanup(() => {
			untracked(() => this.dialog.unregisterDescription(id));
		});
	});
}

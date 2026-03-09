import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { HdlDialog } from './dialog.component';

let nextId = 0;

@Component({
	selector: 'hdl-dialog-title',
	host: {
		'[attr.data-slot]': '"dialog-title"',
		'[id]': 'id()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlDialogTitle {
	private readonly dialog = inject(HdlDialog);
	readonly id = input(`hdl-dialog-title-${nextId++}`);

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id();
		untracked(() => this.dialog.registerTitle(id));
		onCleanup(() => {
			untracked(() => this.dialog.unregisterTitle(id));
		});
	});
}

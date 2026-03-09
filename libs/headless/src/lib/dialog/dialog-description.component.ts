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
	selector: 'hdl-dialog-description',
	host: {
		'[attr.data-slot]': '"dialog-description"',
		'[id]': 'id()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlDialogDescription {
	private readonly dialog = inject(HdlDialog);
	readonly id = input(`hdl-dialog-desc-${nextId++}`);

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id();
		untracked(() => this.dialog.registerDescription(id));
		onCleanup(() => {
			untracked(() => this.dialog.unregisterDescription(id));
		});
	});
}

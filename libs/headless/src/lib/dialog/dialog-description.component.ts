import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	effect,
	inject,
	input,
} from '@angular/core';
import { HdlDialog } from './dialog.component';

let nextId = 0;

@Component({
	selector: 'hdl-dialog-description',
	host: {
		'[id]': 'id()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlDialogDescription {
	private readonly dialog = inject(HdlDialog);
	private readonly destroyRef = inject(DestroyRef);
	readonly id = input(`hdl-dialog-desc-${nextId++}`);

	constructor() {
		effect(() => {
			this.dialog.registerDescription(this.id());
		});

		this.destroyRef.onDestroy(() => {
			queueMicrotask(() => {
				this.dialog.unregisterDescription(this.id());
			});
		});
	}
}

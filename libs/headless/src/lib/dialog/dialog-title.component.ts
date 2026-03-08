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
	private readonly destroyRef = inject(DestroyRef);
	readonly id = input(`hdl-dialog-title-${nextId++}`);

	constructor() {
		effect(() => {
			this.dialog.registerTitle(this.id());
		});

		this.destroyRef.onDestroy(() => {
			queueMicrotask(() => {
				this.dialog.unregisterTitle(this.id());
			});
		});
	}
}

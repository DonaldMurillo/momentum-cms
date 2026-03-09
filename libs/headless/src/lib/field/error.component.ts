import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { HDL_FIELD_CONTEXT } from './field.token';

let nextId = 0;

@Component({
	selector: 'hdl-error',
	host: {
		'[attr.data-slot]': '"error"',
		'[id]': 'id()',
		role: 'alert',
		'[attr.aria-live]': '"polite"',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlError {
	private readonly field = inject(HDL_FIELD_CONTEXT, { optional: true });
	readonly id = input(`hdl-field-error-${nextId++}`);

	constructor() {
		effect((onCleanup) => {
			const id = this.id();
			untracked(() => {
				this.field?.registerError(id);
			});
			onCleanup(() => {
				untracked(() => {
					this.field?.unregisterError(id);
				});
			});
		});
	}
}

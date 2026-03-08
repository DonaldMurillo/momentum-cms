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
	selector: 'hdl-description',
	host: {
		'[attr.data-slot]': '"description"',
		'[id]': 'id()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlDescription {
	private readonly field = inject(HDL_FIELD_CONTEXT, { optional: true });
	readonly id = input(`hdl-field-description-${nextId++}`);

	constructor() {
		effect((onCleanup) => {
			const id = this.id();
			untracked(() => {
				this.field?.registerDescription(id);
			});
			onCleanup(() => {
				untracked(() => {
					this.field?.unregisterDescription(id);
				});
			});
		});
	}
}

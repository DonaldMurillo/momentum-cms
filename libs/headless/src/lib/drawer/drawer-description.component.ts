import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { HdlDrawer } from './drawer.component';

let nextId = 0;

@Component({
	selector: 'hdl-drawer-description',
	host: {
		'[attr.data-slot]': '"drawer-description"',
		'[attr.id]': 'id()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlDrawerDescription {
	private readonly drawer = inject(HdlDrawer);
	readonly id = input(`hdl-drawer-description-${nextId++}`);

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id();
		untracked(() => this.drawer.registerDescription(id));
		onCleanup(() => {
			untracked(() => this.drawer.unregisterDescription(id));
		});
	});
}

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
	selector: 'hdl-drawer-title',
	host: {
		'[attr.data-slot]': '"drawer-title"',
		'[attr.id]': 'id()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlDrawerTitle {
	private readonly drawer = inject(HdlDrawer);
	readonly id = input(`hdl-drawer-title-${nextId++}`);

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id();
		untracked(() => this.drawer.registerTitle(id));
		onCleanup(() => {
			untracked(() => this.drawer.unregisterTitle(id));
		});
	});
}

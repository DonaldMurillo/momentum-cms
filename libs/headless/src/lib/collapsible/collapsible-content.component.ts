import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { HdlCollapsible } from './collapsible.component';

let nextId = 0;

@Component({
	selector: 'hdl-collapsible-content',
	host: {
		'[attr.data-slot]': '"collapsible-content"',
		'[attr.data-state]': 'collapsible.open() ? "open" : "closed"',
		'[attr.data-disabled]': 'collapsible.disabled() ? "true" : null',
		'[attr.id]': 'id()',
		'[attr.hidden]': 'collapsible.open() ? null : ""',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCollapsibleContent {
	protected readonly collapsible = inject(HdlCollapsible);
	readonly id = input(`hdl-collapsible-content-${nextId++}`);

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id();
		untracked(() => this.collapsible.registerContent(id));
		onCleanup(() => {
			untracked(() => this.collapsible.unregisterContent(id));
		});
	});
}

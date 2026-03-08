import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Tab } from '@angular/aria/tabs';

@Component({
	selector: 'hdl-tab',
	host: {
		'[attr.data-slot]': '"tab"',
		'[attr.data-state]': 'tab.selected() ? "selected" : "unselected"',
		'[attr.data-active]': 'tab.active() ? "true" : null',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
	hostDirectives: [
		{
			directive: Tab,
			inputs: ['value', 'disabled'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTab {
	readonly tab = inject(Tab);
	readonly value = input.required<string>();
	readonly disabled = input(false);
}

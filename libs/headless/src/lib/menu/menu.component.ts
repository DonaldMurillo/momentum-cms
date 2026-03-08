import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Menu } from '@angular/aria/menu';

@Component({
	selector: 'hdl-menu',
	host: {
		'[attr.data-slot]': '"menu"',
		'[attr.data-state]': 'menu.visible() ? "open" : "closed"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
	hostDirectives: [
		{
			directive: Menu,
			inputs: ['disabled', 'wrap', 'typeaheadDelay'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlMenu {
	readonly menu = inject(Menu);
	readonly disabled = input(false);
	readonly wrap = input(true);
	readonly typeaheadDelay = input(1000);
}

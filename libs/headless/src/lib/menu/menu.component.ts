import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Menu } from '@angular/aria/menu';

@Component({
	selector: 'hdl-menu',
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

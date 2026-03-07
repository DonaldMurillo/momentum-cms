import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MenuTrigger, Menu } from '@angular/aria/menu';

@Component({
	selector: 'hdl-menu-trigger',
	hostDirectives: [
		{
			directive: MenuTrigger,
			inputs: ['menu'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlMenuTrigger {
	readonly menuTrigger = inject(MenuTrigger);
	readonly menu = input<Menu<string>>();
}

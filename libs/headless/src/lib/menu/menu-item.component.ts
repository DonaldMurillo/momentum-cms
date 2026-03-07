import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { MenuItem } from '@angular/aria/menu';

@Component({
	selector: 'hdl-menu-item',
	hostDirectives: [
		{
			directive: MenuItem,
			inputs: ['value', 'disabled', 'searchTerm', 'submenu'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlMenuItem {
	readonly menuItem = inject(MenuItem);
	readonly value = input.required<string>();
	readonly disabled = input(false);
	readonly searchTerm = model('');
}

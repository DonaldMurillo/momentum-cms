import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { MenuItem } from '@angular/aria/menu';

@Component({
	selector: 'hdl-menu-item',
	host: {
		'[attr.data-slot]': '"menu-item"',
		'[attr.data-active]': 'menuItem.active() ? "true" : null',
		'[attr.data-expanded]':
			'menuItem.expanded() === null ? null : (menuItem.expanded() ? "true" : "false")',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'[attr.data-has-popup]': 'menuItem.hasPopup() ? "true" : null',
	},
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

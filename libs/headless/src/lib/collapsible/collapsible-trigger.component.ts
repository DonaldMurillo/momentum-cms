import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HdlCollapsible } from './collapsible.component';

@Component({
	selector: 'hdl-collapsible-trigger',
	host: {
		'[attr.data-slot]': '"collapsible-trigger"',
		'[attr.data-state]': 'collapsible.open() ? "open" : "closed"',
		'[attr.data-disabled]': 'collapsible.disabled() ? "true" : null',
		role: 'button',
		'[attr.tabindex]': 'collapsible.disabled() ? -1 : 0',
		'[attr.aria-expanded]': 'collapsible.open()',
		'[attr.aria-controls]': 'collapsible.contentId()',
		'(click)': 'collapsible.toggle()',
		'(keydown.enter)': 'toggleFromKeyboard($event)',
		'(keydown.space)': 'toggleFromKeyboard($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCollapsibleTrigger {
	protected readonly collapsible = inject(HdlCollapsible);

	toggleFromKeyboard(event: Event): void {
		event.preventDefault();
		this.collapsible.toggle();
	}
}

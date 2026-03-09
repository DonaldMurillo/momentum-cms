import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AccordionGroup } from '@angular/aria/accordion';

@Component({
	selector: 'hdl-accordion',
	host: {
		'[attr.data-slot]': '"accordion"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'[attr.data-multiple]': 'multiExpandable() ? "true" : null',
	},
	hostDirectives: [
		{
			directive: AccordionGroup,
			inputs: ['disabled', 'multiExpandable', 'wrap'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlAccordion {
	readonly ariaDirective = inject(AccordionGroup);
	readonly disabled = input(false);
	readonly multiExpandable = input(false);
	readonly wrap = input(true);
}

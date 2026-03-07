import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccordionGroup } from '@angular/aria/accordion';

@Component({
	selector: 'hdl-accordion',
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
	readonly disabled = input(false);
	readonly multiExpandable = input(false);
	readonly wrap = input(true);
}

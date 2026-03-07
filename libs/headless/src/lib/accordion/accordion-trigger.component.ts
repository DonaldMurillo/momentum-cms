import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { AccordionTrigger } from '@angular/aria/accordion';

@Component({
	selector: 'hdl-accordion-trigger',
	hostDirectives: [
		{
			directive: AccordionTrigger,
			inputs: ['panelId', 'disabled', 'expanded'],
			outputs: ['expandedChange'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlAccordionTrigger {
	readonly trigger = inject(AccordionTrigger);
	readonly panelId = input.required<string>();
	readonly disabled = input(false);
	readonly expanded = model(false);
}

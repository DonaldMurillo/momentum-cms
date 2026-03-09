import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { AccordionTrigger } from '@angular/aria/accordion';

@Component({
	selector: 'hdl-accordion-trigger',
	host: {
		'[attr.data-slot]': '"accordion-trigger"',
		'[attr.data-state]': 'expanded() ? "open" : "closed"',
		'[attr.data-active]': 'trigger.active() ? "true" : null',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
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

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AccordionPanel, AccordionContent } from '@angular/aria/accordion';

@Component({
	selector: 'hdl-accordion-content',
	hostDirectives: [
		{
			directive: AccordionPanel,
			inputs: ['panelId'],
		},
	],
	host: {
		'[attr.data-slot]': '"accordion-content"',
		'[attr.data-state]': 'panel.visible() ? "open" : "closed"',
		'[hidden]': '!panel.visible()',
	},
	imports: [AccordionContent],
	template: `
		<ng-template ngAccordionContent>
			<ng-content />
		</ng-template>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlAccordionContent {
	readonly panel = inject(AccordionPanel);
	readonly panelId = input.required<string>();
}

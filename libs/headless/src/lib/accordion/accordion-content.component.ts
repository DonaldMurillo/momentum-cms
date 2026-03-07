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

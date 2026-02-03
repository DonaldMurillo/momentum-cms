import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AccordionPanel, AccordionContent as AriaAccordionContent } from '@angular/aria/accordion';

/**
 * Accordion content panel that shows/hides based on trigger state.
 *
 * @example
 * ```html
 * <mcms-accordion-content panelId="item1">
 *   <p>This content is shown when the accordion item is expanded.</p>
 * </mcms-accordion-content>
 * ```
 */
@Component({
	selector: 'mcms-accordion-content',
	hostDirectives: [
		{
			directive: AccordionPanel,
			inputs: ['panelId'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		'[hidden]': '!panel.visible()',
	},
	template: `
		<ng-template ngAccordionContent>
			<div [class]="contentClasses()">
				<ng-content />
			</div>
		</ng-template>
	`,
	imports: [AriaAccordionContent],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccordionContent {
	readonly panel = inject(AccordionPanel);

	/** Unique identifier to match with the corresponding trigger. */
	readonly panelId = input.required<string>();

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `overflow-hidden text-sm ${this.class()}`.trim();
	});

	readonly contentClasses = computed(() => {
		return 'pb-4 pt-0';
	});
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AccordionGroup } from '@angular/aria/accordion';

/**
 * Accordion root component that wraps accordion items.
 *
 * @example
 * ```html
 * <mcms-accordion>
 *   <mcms-accordion-item>
 *     <mcms-accordion-trigger panelId="item1">Section 1</mcms-accordion-trigger>
 *     <mcms-accordion-content panelId="item1">
 *       Content for section 1
 *     </mcms-accordion-content>
 *   </mcms-accordion-item>
 * </mcms-accordion>
 * ```
 */
@Component({
	selector: 'mcms-accordion',
	hostDirectives: [
		{
			directive: AccordionGroup,
			inputs: ['disabled', 'multiExpandable', 'wrap'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Accordion {
	/** Whether multiple items can be expanded at once. */
	readonly multiExpandable = input(false);

	/** Whether the accordion is disabled. */
	readonly disabled = input(false);

	/** Whether keyboard navigation should wrap. */
	readonly wrap = input(true);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `block ${this.class()}`.trim();
	});
}

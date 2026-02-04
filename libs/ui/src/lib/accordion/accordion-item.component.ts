import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Accordion item wrapper component.
 * Contains an accordion trigger and its corresponding content panel.
 *
 * @example
 * ```html
 * <mcms-accordion-item>
 *   <mcms-accordion-trigger panelId="item1">Section Title</mcms-accordion-trigger>
 *   <mcms-accordion-content panelId="item1">
 *     <p>Section content goes here</p>
 *   </mcms-accordion-content>
 * </mcms-accordion-item>
 * ```
 */
@Component({
	selector: 'mcms-accordion-item',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccordionItem {
	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		return `block border-b ${this.class()}`.trim();
	});
}

import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { AccordionTrigger as AriaAccordionTrigger } from '@angular/aria/accordion';

/**
 * Accordion trigger button that toggles the visibility of its panel.
 *
 * @example
 * ```html
 * <mcms-accordion-trigger panelId="item1">
 *   Section Title
 * </mcms-accordion-trigger>
 * ```
 */
@Component({
	selector: 'mcms-accordion-trigger',
	hostDirectives: [
		{
			directive: AriaAccordionTrigger,
			inputs: ['panelId', 'disabled', 'expanded'],
			outputs: ['expandedChange'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		<ng-content />
		<svg
			[class]="iconClasses()"
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccordionTrigger {
	readonly trigger = inject(AriaAccordionTrigger);

	/** Unique identifier to match with the corresponding panel. */
	readonly panelId = input.required<string>();

	/** Whether the trigger is disabled. */
	readonly disabled = input(false);

	/** Whether the panel is expanded. */
	readonly expanded = model(false);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base =
			'flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline text-left w-full';
		const disabledClasses = this.disabled() ? 'opacity-50 cursor-not-allowed' : '';

		return `${base} ${disabledClasses} ${this.class()}`.trim();
	});

	readonly iconClasses = computed(() => {
		const base = 'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200';
		const expandedClasses = this.trigger.expanded() ? 'rotate-180' : '';

		return `${base} ${expandedClasses}`.trim();
	});
}

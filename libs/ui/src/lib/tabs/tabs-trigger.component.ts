import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Tab } from '@angular/aria/tabs';

/**
 * Individual tab trigger button.
 *
 * @example
 * ```html
 * <mcms-tabs-trigger value="tab1">Tab 1</mcms-tabs-trigger>
 * <mcms-tabs-trigger value="tab2" [disabled]="true">Disabled Tab</mcms-tabs-trigger>
 * ```
 */
@Component({
	selector: 'mcms-tabs-trigger',
	hostDirectives: [
		{
			directive: Tab,
			inputs: ['value', 'disabled'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsTrigger {
	private readonly tab = inject(Tab);

	/** Unique value identifying this tab. */
	readonly value = input.required<string>();

	/** Whether the tab is disabled. */
	readonly disabled = input(false);

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base =
			'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
		const selectedClasses = this.tab.selected() ? 'bg-background text-foreground shadow' : '';

		return `${base} ${selectedClasses} ${this.class()}`.trim();
	});
}

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Menu } from '@angular/aria/menu';

/**
 * Dropdown menu container component.
 *
 * Uses @angular/aria/menu for keyboard navigation, typeahead search, and accessibility.
 *
 * Usage:
 * ```html
 * <mcms-dropdown-menu>
 *   <mcms-dropdown-label>Actions</mcms-dropdown-label>
 *   <button mcms-dropdown-item value="edit">Edit</button>
 *   <button mcms-dropdown-item value="duplicate">Duplicate</button>
 *   <mcms-dropdown-separator />
 *   <button mcms-dropdown-item value="delete">Delete</button>
 * </mcms-dropdown-menu>
 * ```
 */
@Component({
	selector: 'mcms-dropdown-menu',
	hostDirectives: [
		{
			directive: Menu,
			inputs: ['disabled', 'wrap', 'typeaheadDelay'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'menu',
		'[attr.aria-orientation]': '"vertical"',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownMenu {
	protected readonly menu = inject(Menu);

	/** Whether the menu is disabled */
	readonly disabled = input(false);

	/** Whether navigation wraps around */
	readonly wrap = input(true);

	/** Typeahead delay in milliseconds */
	readonly typeaheadDelay = input(1000);

	/** Emits when an item is selected */
	readonly itemSelected = output<string>();

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base =
			'flex flex-col z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-card text-card-foreground p-1 shadow-lg animate-in fade-in-0 zoom-in-95';
		return `${base} ${this.class()}`.trim();
	});
}

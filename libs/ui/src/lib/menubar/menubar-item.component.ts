import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { MenuItem as AriaMenuItem } from '@angular/aria/menu';
import { MenubarSubmenu } from './menubar-submenu.component';

/**
 * A top-level item in the menubar.
 *
 * @example
 * ```html
 * <mcms-menubar-item value="file" label="File" [submenu]="fileMenu">
 *   <mcms-menubar-submenu #fileMenu>
 *     ...submenu content
 *   </mcms-menubar-submenu>
 * </mcms-menubar-item>
 * ```
 */
@Component({
	selector: 'mcms-menubar-item',
	exportAs: 'mcmsMenubarItem',
	hostDirectives: [
		{
			directive: AriaMenuItem,
			inputs: ['value', 'disabled', 'searchTerm', 'submenu'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'menuitem',
		'[attr.aria-haspopup]': 'menuItem.hasPopup() ? "menu" : null',
		'[attr.aria-expanded]': 'menuItem.expanded() || null',
		'[attr.tabindex]': 'menuItem.active() ? 0 : -1',
	},
	template: `
		<span class="flex items-center gap-2">
			<ng-content select="[mcms-menubar-item-icon]" />
			{{ label() }}
		</span>
		@if (menuItem.hasPopup()) {
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="ml-1 h-3 w-3"
				aria-hidden="true"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		}
		<ng-content />
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenubarItem {
	readonly menuItem = inject(AriaMenuItem<string>);

	/** The unique value for this item */
	readonly value = input.required<string>();

	/** Display label */
	readonly label = input.required<string>();

	/** Whether the item is disabled */
	readonly disabled = input(false);

	/** Text used for typeahead search */
	readonly searchTerm = model('');

	/** Reference to the submenu component */
	readonly submenu = input<MenubarSubmenu>();

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base =
			'inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-sm cursor-default select-none outline-none';
		const interactiveClasses =
			'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';
		const activeClasses = this.menuItem.active() ? 'bg-accent text-accent-foreground' : '';
		const expandedClasses = this.menuItem.expanded() ? 'bg-accent text-accent-foreground' : '';
		const disabledClasses = this.disabled() ? 'opacity-50 pointer-events-none' : '';
		return `${base} ${interactiveClasses} ${activeClasses} ${expandedClasses} ${disabledClasses} ${this.class()}`.trim();
	});
}

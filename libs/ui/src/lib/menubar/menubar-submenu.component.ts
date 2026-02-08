import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { Menu as AriaMenu, MenuItem as AriaMenuItem } from '@angular/aria/menu';

/**
 * A submenu dropdown for menubar items.
 *
 * @example
 * ```html
 * <mcms-menubar-submenu #fileMenu>
 *   <mcms-menubar-submenu-item value="new" label="New" shortcut="⌘N" />
 *   <mcms-menubar-submenu-item value="open" label="Open" shortcut="⌘O" />
 *   <mcms-menubar-separator />
 *   <mcms-menubar-submenu-item value="exit" label="Exit" />
 * </mcms-menubar-submenu>
 * ```
 */
@Component({
	selector: 'mcms-menubar-submenu',
	exportAs: 'mcmsMenubarSubmenu',
	hostDirectives: [
		{
			directive: AriaMenu,
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
export class MenubarSubmenu {
	readonly menu = inject(AriaMenu);
	readonly parent = model<AriaMenuItem<string> | undefined>(undefined);

	/** Whether the submenu is disabled */
	readonly disabled = input(false);

	/** Whether navigation wraps around */
	readonly wrap = input(true);

	/** Typeahead delay in milliseconds */
	readonly typeaheadDelay = input(500);

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base =
			'absolute left-0 top-full z-50 min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md';
		return `${base} ${this.class()}`.trim();
	});
}

/**
 * A menu item inside a menubar submenu.
 *
 * @example
 * ```html
 * <mcms-menubar-submenu-item value="new" label="New" shortcut="⌘N" />
 * ```
 */
@Component({
	selector: 'mcms-menubar-submenu-item',
	exportAs: 'mcmsMenubarSubmenuItem',
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
		<span class="flex flex-1 items-center gap-2">
			<ng-content select="[mcms-menubar-submenu-item-icon]" />
			{{ label() }}
		</span>
		@if (shortcut()) {
			<span class="ml-auto text-xs tracking-widest text-muted-foreground">
				{{ shortcut() }}
			</span>
		}
		@if (menuItem.hasPopup()) {
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="ml-2 h-4 w-4"
			>
				<polyline points="9 18 15 12 9 6" />
			</svg>
		}
		<ng-content />
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenubarSubmenuItem {
	readonly menuItem = inject(AriaMenuItem<string>);

	/** The unique value for this item */
	readonly value = input.required<string>();

	/** Display label */
	readonly label = input.required<string>();

	/** Whether the item is disabled */
	readonly disabled = input(false);

	/** Keyboard shortcut hint */
	readonly shortcut = input<string>();

	/** Text used for typeahead search */
	readonly searchTerm = model('');

	/** Reference to a nested submenu */
	readonly submenu = input<MenubarSubmenu>();

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base =
			'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none';
		const interactiveClasses =
			'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';
		const activeClasses = this.menuItem.active() ? 'bg-accent text-accent-foreground' : '';
		const disabledClasses = this.disabled() ? 'opacity-50 pointer-events-none' : '';
		return `${base} ${interactiveClasses} ${activeClasses} ${disabledClasses} ${this.class()}`.trim();
	});
}

/**
 * Separator line within a menubar submenu.
 */
@Component({
	selector: 'mcms-menubar-separator',
	host: {
		'[class]': 'hostClasses()',
		role: 'separator',
	},
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenubarSeparator {
	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = '-mx-1 my-1 h-px bg-border';
		return `${base} ${this.class()}`.trim();
	});
}

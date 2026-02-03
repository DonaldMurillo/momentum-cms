import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MenuItem } from '@angular/aria/menu';

/**
 * Dropdown menu item component.
 *
 * Uses @angular/aria/menu MenuItem for keyboard navigation and accessibility.
 *
 * Usage:
 * ```html
 * <button mcms-dropdown-item value="edit">Edit</button>
 * <button mcms-dropdown-item value="disabled" [disabled]="true">Disabled</button>
 * <button mcms-dropdown-item value="search" shortcut="⌘K">Search</button>
 * ```
 */
@Component({
	selector: 'button[mcms-dropdown-item], a[mcms-dropdown-item]',
	hostDirectives: [
		{
			directive: MenuItem,
			inputs: ['value', 'disabled', 'searchTerm'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'menuitem',
		'[attr.tabindex]': 'disabled() ? -1 : 0',
		'[attr.disabled]': 'disabled() || null',
		'[attr.aria-disabled]': 'disabled()',
		'(click)': 'onClick($event)',
		'(keydown.enter)': 'onClick($event)',
		'(keydown.space)': 'onClick($event); $event.preventDefault()',
	},
	template: `
		<ng-content />
		@if (shortcut()) {
			<span class="ml-auto text-xs tracking-widest text-muted-foreground">{{ shortcut() }}</span>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownMenuItem {
	protected readonly menuItem = inject(MenuItem);

	/** The value of the menu item (required for @angular/aria) */
	readonly value = input.required<string>();

	/** Whether the menu item is disabled */
	readonly disabled = input(false);

	/** Keyboard shortcut display text */
	readonly shortcut = input<string | undefined>(undefined);

	/** Emits when the item is selected */
	readonly selected = output<void>();

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base =
			'flex items-center justify-between gap-2 cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm outline-none transition-colors w-full text-left bg-transparent border-none text-inherit';
		const interactiveClasses = this.disabled()
			? 'pointer-events-none opacity-50'
			: 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';
		const activeClasses = this.menuItem.active() ? 'bg-accent text-accent-foreground' : '';
		return `${base} ${interactiveClasses} ${activeClasses} ${this.class()}`.trim();
	});

	onClick(event: Event): void {
		if (this.disabled()) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		this.selected.emit();
	}
}

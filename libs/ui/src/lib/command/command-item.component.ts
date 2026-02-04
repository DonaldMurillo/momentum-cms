import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/**
 * A selectable item in the command list.
 *
 * @example
 * ```html
 * <mcms-command-item value="settings" (select)="onSelect()">
 *   <svg>...</svg>
 *   Settings
 *   <span class="ml-auto text-xs text-muted-foreground">⌘S</span>
 * </mcms-command-item>
 * ```
 */
@Component({
	selector: 'mcms-command-item',
	host: {
		'[class]': 'hostClasses()',
		'(click)': 'onSelect()',
		'(keydown.enter)': 'onSelect()',
		'(mouseenter)': 'onMouseEnter()',
		'(mouseleave)': 'onMouseLeave()',
		role: 'option',
		'[attr.aria-selected]': 'selected()',
		'[attr.aria-disabled]': 'disabled()',
		'[attr.data-active]': 'active()',
		tabindex: '0',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandItem {
	/** The value of the item */
	readonly value = input.required<string>();

	/** Text label for accessibility and typeahead search */
	readonly label = input<string>();

	/** Whether the item is disabled */
	readonly disabled = input(false);

	/** Whether the item is selected */
	readonly selected = input(false);

	/** Emits when the item is selected */
	readonly select = output<void>();

	/** Additional CSS classes */
	readonly class = input('');

	/** Whether the item is currently active (hovered/focused) */
	protected readonly active = signal(false);

	protected readonly hostClasses = computed(() => {
		const base =
			'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none';
		const interactiveClasses = this.disabled() ? 'pointer-events-none opacity-50' : '';
		const activeClasses = this.active() ? 'bg-accent text-accent-foreground' : '';
		return `${base} ${interactiveClasses} ${activeClasses} ${this.class()}`.trim();
	});

	protected onSelect(): void {
		if (!this.disabled()) {
			this.select.emit();
		}
	}

	protected onMouseEnter(): void {
		if (!this.disabled()) {
			this.active.set(true);
		}
	}

	protected onMouseLeave(): void {
		this.active.set(false);
	}
}

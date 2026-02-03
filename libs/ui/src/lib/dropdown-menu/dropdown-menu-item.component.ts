import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	inject,
	input,
	output,
} from '@angular/core';
import type { FocusableOption } from '@angular/cdk/a11y';

/**
 * Dropdown menu item component.
 *
 * Usage:
 * ```html
 * <button mcms-dropdown-item>Edit</button>
 * <button mcms-dropdown-item [disabled]="true">Disabled</button>
 * <button mcms-dropdown-item shortcut="⌘K">Search</button>
 * ```
 */
@Component({
	selector: 'button[mcms-dropdown-item], a[mcms-dropdown-item]',
	host: {
		role: 'menuitem',
		'[attr.tabindex]': 'disabledInput() ? -1 : 0',
		'[attr.disabled]': 'disabledInput() || null',
		'[attr.aria-disabled]': 'disabledInput()',
		'(click)': 'onClick($event)',
		'(keydown.enter)': 'onClick($event)',
		'(keydown.space)': 'onClick($event); $event.preventDefault()',
	},
	template: `
		<ng-content />
		@if (shortcut()) {
			<span class="dropdown-shortcut">{{ shortcut() }}</span>
		}
	`,
	styles: `
		:host {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
			cursor: pointer;
			user-select: none;
			border-radius: 0.25rem;
			padding: 0.375rem 0.5rem;
			font-size: 0.875rem;
			outline: none;
			transition:
				background-color 0.1s,
				color 0.1s;
			background: transparent;
			border: none;
			width: 100%;
			text-align: left;
			color: inherit;
		}

		:host(:hover:not([disabled])),
		:host(:focus:not([disabled])) {
			background-color: hsl(var(--mcms-accent));
			color: hsl(var(--mcms-accent-foreground));
		}

		:host([disabled]) {
			pointer-events: none;
			opacity: 0.5;
		}

		.dropdown-shortcut {
			margin-left: auto;
			font-size: 0.75rem;
			letter-spacing: 0.1em;
			color: hsl(var(--mcms-muted-foreground));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownMenuItem implements FocusableOption {
	readonly disabledInput = input(false, { alias: 'disabled' });
	readonly shortcut = input<string | undefined>(undefined);
	readonly selected = output<void>();

	private readonly elementRef = inject(ElementRef<HTMLElement>);

	/** Property required by FocusableOption interface */
	get disabled(): boolean {
		return this.disabledInput();
	}

	focus(): void {
		this.elementRef.nativeElement.focus();
	}

	onClick(event: Event): void {
		if (this.disabledInput()) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		this.selected.emit();
	}
}

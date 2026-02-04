import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { ValidationError } from '../input/input.types';

/**
 * Checkbox component compatible with Angular Signal Forms.
 *
 * Implements FormValueControl<boolean> interface for use with [formField] directive.
 *
 * Usage:
 * ```html
 * <mcms-checkbox [formField]="myForm.acceptTerms">Accept Terms</mcms-checkbox>
 * ```
 */
@Component({
	selector: 'mcms-checkbox',
	host: {
		class: 'inline-flex items-center gap-2',
		'[class.mcms-checkbox--error]': 'hasError()',
		'[class.mcms-checkbox--disabled]': 'disabled()',
	},
	template: `
		<button
			type="button"
			role="checkbox"
			[id]="id()"
			[attr.aria-checked]="value()"
			[attr.aria-invalid]="hasError() || null"
			[attr.aria-describedby]="ariaDescribedBy()"
			[disabled]="disabled()"
			(click)="toggle()"
			(keydown.space)="toggle(); $event.preventDefault()"
			[class.checked]="value()"
			[class.error]="hasError()"
			class="checkbox-button"
		>
			@if (value()) {
				<svg
					class="check-icon"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="3"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			}
		</button>
		<label [attr.for]="id()" class="checkbox-label">
			<ng-content />
		</label>
	`,
	styles: `
		:host {
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
		}
		:host(.mcms-checkbox--disabled) {
			cursor: not-allowed;
			opacity: 0.5;
		}
		.checkbox-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1rem;
			height: 1rem;
			flex-shrink: 0;
			border-radius: 0.125rem;
			border: 1px solid hsl(var(--mcms-primary));
			background-color: transparent;
			cursor: pointer;
			padding: 0;
			transition:
				background-color 0.15s,
				border-color 0.15s;
		}
		.checkbox-button:focus-visible {
			outline: none;
			box-shadow:
				0 0 0 2px hsl(var(--mcms-background)),
				0 0 0 4px hsl(var(--mcms-ring));
		}
		.checkbox-button:disabled {
			cursor: not-allowed;
			opacity: 0.5;
		}
		.checkbox-button.error {
			border-color: hsl(var(--mcms-destructive));
		}
		.checkbox-button.checked {
			background-color: hsl(var(--mcms-primary));
			color: hsl(var(--mcms-primary-foreground));
		}
		.check-icon {
			width: 1rem;
			height: 1rem;
		}
		.checkbox-label {
			font-size: 0.875rem;
			font-weight: 500;
			line-height: 1;
			color: hsl(var(--mcms-foreground));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkbox {
	// === FormValueControl implementation ===
	readonly value = model(false);
	readonly disabled = input(false);
	readonly errors = input<readonly ValidationError[]>([]);

	// === Component-specific configuration ===
	readonly id = input('');
	readonly describedBy = input<string | undefined>(undefined);

	// === Computed state ===
	readonly hasError = computed(() => this.errors().length > 0);

	readonly ariaDescribedBy = computed(() => {
		const parts: string[] = [];
		const described = this.describedBy();
		if (described) parts.push(described);
		if (this.hasError() && this.id()) parts.push(`${this.id()}-error`);
		return parts.length > 0 ? parts.join(' ') : null;
	});

	toggle(): void {
		if (!this.disabled()) {
			this.value.set(!this.value());
		}
	}
}

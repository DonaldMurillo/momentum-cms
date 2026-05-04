import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import type { InputType, ValidationError } from './input.types';

/**
 * Text input component compatible with Angular Signal Forms.
 *
 * Implements FormValueControl<string> interface for use with [formField] directive.
 *
 * Usage:
 * ```html
 * <mcms-input [formField]="myForm.email" type="email" placeholder="Enter email" />
 * ```
 */
@Component({
	selector: 'mcms-input',
	host: {
		class: 'block',
		'[class.mcms-input--error]': 'hasError()',
		'[class.mcms-input--disabled]': 'disabled()',
		'[attr.id]': 'null', // Remove host id to prevent duplicate with inner input
	},
	template: `
		<input
			#inputEl
			[type]="type()"
			[id]="id()"
			[name]="name()"
			[value]="value()"
			[disabled]="disabled()"
			[placeholder]="placeholder()"
			[attr.aria-invalid]="hasError() || null"
			[attr.aria-describedby]="ariaDescribedBy()"
			[attr.aria-label]="ariaLabel() || null"
			[attr.aria-required]="required() || null"
			[attr.autocomplete]="autocomplete()"
			[attr.min]="min()"
			[attr.max]="max()"
			[attr.step]="step()"
			(input)="value.set(inputEl.value)"
			(blur)="blurred.emit()"
		/>
	`,
	styles: `
		input {
			display: flex;
			height: 2.125rem; /* 34px — matches button md */
			width: 100%;
			border-radius: var(--mcms-radius);
			border: 1px solid hsl(var(--mcms-input));
			background-color: hsl(var(--mcms-background));
			padding: 0.375rem 0.625rem;
			font-family: var(--mcms-font-sans);
			font-size: var(--mcms-text-sm);
			line-height: 1.4;
			color: hsl(var(--mcms-foreground));
		}
		input::placeholder {
			color: hsl(var(--mcms-muted-foreground));
		}
		input:hover:not(:disabled):not(:focus-visible) {
			border-color: hsl(var(--mcms-foreground) / 0.25);
		}
		input:focus-visible {
			outline: none;
			border-color: hsl(var(--mcms-ring));
			box-shadow:
				0 0 0 2px hsl(var(--mcms-background)),
				0 0 0 3px hsl(var(--mcms-ring));
		}
		input:disabled {
			cursor: not-allowed;
			opacity: 0.5;
		}
		:host(.mcms-input--error) input {
			border-color: hsl(var(--mcms-destructive));
		}
		:host(.mcms-input--error) input:focus-visible {
			box-shadow:
				0 0 0 2px hsl(var(--mcms-background)),
				0 0 0 3px hsl(var(--mcms-destructive));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Input {
	// === FormValueControl implementation (for [formField] directive) ===

	/** Two-way bound value - Signal Forms binds to this automatically */
	readonly value = model('');

	/** Disabled state - Signal Forms passes this from field.disabled() */
	readonly disabled = input(false);

	/** Validation errors - Signal Forms passes this from field.errors() */
	readonly errors = input<readonly ValidationError[]>([]);

	/** Whether the field has been interacted with (set by [formField] directive) */
	readonly touched = input(false);

	/** Whether the field is invalid (set by [formField] directive) */
	readonly invalid = input(false);

	/** Whether the field is readonly (set by [formField] directive) */
	readonly readonly = input(false);

	/** Whether the field is required (set by [formField] directive) */
	readonly required = input(false);

	// === Component-specific configuration ===

	readonly type = input<InputType>('text');
	readonly id = input('');
	readonly name = input('');
	readonly placeholder = input('');
	readonly autocomplete = input<string | undefined>(undefined);
	readonly ariaLabel = input<string | undefined>(undefined);
	readonly describedBy = input<string | undefined>(undefined);
	readonly min = input<number | undefined>(undefined);
	readonly max = input<number | undefined>(undefined);
	readonly step = input<number | undefined>(undefined);

	/** Emitted when the input loses focus */
	readonly blurred = output<void>();

	// === Computed state ===

	readonly hasError = computed(() => this.errors().length > 0);

	readonly ariaDescribedBy = computed(() => {
		const parts: string[] = [];
		const described = this.describedBy();
		if (described) parts.push(described);
		if (this.hasError() && this.id()) parts.push(`${this.id()}-error`);
		return parts.length > 0 ? parts.join(' ') : null;
	});
}

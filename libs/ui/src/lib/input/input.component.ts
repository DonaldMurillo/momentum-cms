import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
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
			[attr.autocomplete]="autocomplete()"
			(input)="value.set(inputEl.value)"
		/>
	`,
	styles: `
		input {
			display: flex;
			height: 2.5rem;
			width: 100%;
			border-radius: 0.375rem;
			border: 1px solid hsl(var(--mcms-input));
			background-color: hsl(var(--mcms-background));
			padding: 0.5rem 0.75rem;
			font-size: 0.875rem;
			line-height: 1.25rem;
			color: hsl(var(--mcms-foreground));
		}
		input::placeholder {
			color: hsl(var(--mcms-muted-foreground));
		}
		input:focus-visible {
			outline: none;
			ring: 2px solid hsl(var(--mcms-ring));
			ring-offset: 2px;
		}
		input:disabled {
			cursor: not-allowed;
			opacity: 0.5;
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

	// === Component-specific configuration ===

	readonly type = input<InputType>('text');
	readonly id = input('');
	readonly name = input('');
	readonly placeholder = input('');
	readonly autocomplete = input<string | undefined>(undefined);
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
}

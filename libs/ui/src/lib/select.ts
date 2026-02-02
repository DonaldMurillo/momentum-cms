import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { ValidationError } from './input';

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

/**
 * Select dropdown component compatible with Angular Signal Forms.
 *
 * Implements FormValueControl<string> interface for use with [formField] directive.
 *
 * Usage:
 * ```html
 * <mcms-select [formField]="myForm.status" [options]="statusOptions" placeholder="Select status" />
 * ```
 */
@Component({
	selector: 'mcms-select',
	host: {
		class: 'block',
		'[class.mcms-select--error]': 'hasError()',
		'[class.mcms-select--disabled]': 'disabled()',
	},
	template: `
		<select
			#selectEl
			[id]="id()"
			[name]="name()"
			[disabled]="disabled()"
			[attr.aria-invalid]="hasError() || null"
			[attr.aria-describedby]="ariaDescribedBy()"
			(change)="value.set(selectEl.value)"
			class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm
			       text-foreground placeholder:text-muted-foreground
			       focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
			       disabled:cursor-not-allowed disabled:opacity-50
			       aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive"
		>
			@if (placeholder()) {
				<option value="" disabled [selected]="!value()">{{ placeholder() }}</option>
			}
			@for (option of options(); track option.value) {
				<option
					[value]="option.value"
					[disabled]="option.disabled"
					[selected]="value() === option.value"
				>
					{{ option.label }}
				</option>
			}
		</select>
	`,
	styles: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select {
	// === FormValueControl implementation ===
	readonly value = model('');
	readonly disabled = input(false);
	readonly errors = input<readonly ValidationError[]>([]);

	// === Component-specific configuration ===
	readonly id = input('');
	readonly name = input('');
	readonly placeholder = input('');
	readonly options = input<SelectOption[]>([]);
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

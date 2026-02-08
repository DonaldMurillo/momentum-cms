import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { ValidationError } from '../input/input.types';
import type { RadioOption } from './radio-group.types';

/**
 * Radio group component compatible with Angular Signal Forms.
 *
 * Implements FormValueControl<string> interface for use with [formField] directive.
 *
 * Usage:
 * ```html
 * <mcms-radio-group [formField]="myForm.role" [options]="roleOptions" />
 * ```
 */
@Component({
	selector: 'mcms-radio-group',
	host: {
		class: 'block',
		role: 'radiogroup',
		'[class.mcms-radio-group--error]': 'hasError()',
		'[class.mcms-radio-group--disabled]': 'disabled()',
		'[attr.aria-invalid]': 'hasError() || null',
		'[attr.aria-describedby]': 'ariaDescribedBy()',
	},
	template: `
		<div class="flex flex-col gap-2">
			@for (option of options(); track option.value) {
				<!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -- label wraps button[role=radio], not a native input -->
				<label
					class="flex items-center gap-2 cursor-pointer"
					[class.opacity-50]="option.disabled || disabled()"
					[class.cursor-not-allowed]="option.disabled || disabled()"
				>
					<button
						type="button"
						role="radio"
						[attr.aria-checked]="value() === option.value"
						[disabled]="option.disabled || disabled()"
						(click)="selectOption(option.value)"
						class="aspect-square h-4 w-4 rounded-full border border-primary text-primary
						       focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
						       disabled:cursor-not-allowed disabled:opacity-50"
					>
						@if (value() === option.value) {
							<span class="flex items-center justify-center">
								<span class="h-2.5 w-2.5 rounded-full bg-current"></span>
							</span>
						}
					</button>
					<span class="text-sm font-medium leading-none">{{ option.label }}</span>
				</label>
			}
		</div>
	`,
	styles: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioGroup {
	// === FormValueControl implementation ===
	readonly value = model('');
	readonly disabled = input(false);
	readonly errors = input<readonly ValidationError[]>([]);

	// === Component-specific configuration ===
	readonly id = input('');
	readonly name = input('');
	readonly options = input<RadioOption[]>([]);
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

	selectOption(optionValue: string): void {
		if (!this.disabled()) {
			this.value.set(optionValue);
		}
	}
}

import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import type { ValidationError } from '../input/input.types';
import type { SelectOption } from './select.types';

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
		<div class="relative">
			<select
				#selectEl
				[id]="id()"
				[name]="name()"
				[disabled]="disabled()"
				[attr.aria-invalid]="hasError() || null"
				[attr.aria-describedby]="ariaDescribedBy()"
				(change)="value.set(selectEl.value)"
				(blur)="blurred.emit()"
				class="flex h-10 w-full appearance-none items-center rounded-md border border-input bg-background pl-3 pr-10 py-2 text-sm
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
			<svg
				class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="m6 9 6 6 6-6" />
			</svg>
		</div>
	`,
	styles: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select {
	// === FormValueControl implementation ===
	readonly value = model('');
	readonly disabled = input(false);
	readonly errors = input<readonly ValidationError[]>([]);
	readonly touched = input(false);
	readonly invalid = input(false);
	readonly readonly = input(false);
	readonly required = input(false);

	/** Emitted when the select loses focus */
	readonly blurred = output<void>();

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

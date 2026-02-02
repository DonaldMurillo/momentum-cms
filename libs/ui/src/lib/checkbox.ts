import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { ValidationError } from './input';

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
			class="peer h-4 w-4 shrink-0 rounded-sm border border-primary
			       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
			       disabled:cursor-not-allowed disabled:opacity-50
			       aria-[invalid=true]:border-destructive
			       aria-checked:bg-primary aria-checked:text-primary-foreground"
		>
			@if (value()) {
				<svg
					class="h-4 w-4"
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
		<label
			[attr.for]="id()"
			class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
		>
			<ng-content />
		</label>
	`,
	styles: ``,
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

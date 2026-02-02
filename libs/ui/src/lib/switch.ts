import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { ValidationError } from './input';

/**
 * Toggle switch component compatible with Angular Signal Forms.
 *
 * Implements FormValueControl<boolean> interface for use with [formField] directive.
 *
 * Usage:
 * ```html
 * <mcms-switch [formField]="myForm.enabled">Enable notifications</mcms-switch>
 * ```
 */
@Component({
	selector: 'mcms-switch',
	host: {
		class: 'inline-flex items-center gap-2',
		'[class.mcms-switch--error]': 'hasError()',
		'[class.mcms-switch--disabled]': 'disabled()',
	},
	template: `
		<button
			type="button"
			role="switch"
			[id]="id()"
			[attr.aria-checked]="value()"
			[attr.aria-invalid]="hasError() || null"
			[attr.aria-describedby]="ariaDescribedBy()"
			[disabled]="disabled()"
			(click)="toggle()"
			class="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
			       transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
			       disabled:cursor-not-allowed disabled:opacity-50
			       aria-[invalid=true]:ring-destructive"
			[class.bg-primary]="value()"
			[class.bg-input]="!value()"
		>
			<span
				class="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform"
				[class.translate-x-5]="value()"
				[class.translate-x-0]="!value()"
			></span>
		</button>
		@if (hasLabel()) {
			<label
				[attr.for]="id()"
				class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
			>
				<ng-content />
			</label>
		}
	`,
	styles: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Switch {
	// === FormValueControl implementation ===
	readonly value = model(false);
	readonly disabled = input(false);
	readonly errors = input<readonly ValidationError[]>([]);

	// === Component-specific configuration ===
	readonly id = input('');
	readonly describedBy = input<string | undefined>(undefined);
	readonly hasLabel = input(true);

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

import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import type { ValidationError } from '../input/input.types';

/**
 * Textarea component compatible with Angular Signal Forms.
 *
 * Implements FormValueControl<string> interface for use with [formField] directive.
 *
 * Usage:
 * ```html
 * <mcms-textarea [formField]="myForm.description" placeholder="Enter description" />
 * ```
 */
@Component({
	selector: 'mcms-textarea',
	host: {
		class: 'block',
		'[class.mcms-textarea--error]': 'hasError()',
		'[class.mcms-textarea--disabled]': 'disabled()',
	},
	template: `
		<textarea
			#textareaEl
			[id]="id()"
			[name]="name()"
			[value]="value()"
			[disabled]="disabled()"
			[placeholder]="placeholder()"
			[rows]="rows()"
			[attr.aria-invalid]="hasError() || null"
			[attr.aria-describedby]="ariaDescribedBy()"
			[attr.aria-label]="ariaLabel() || null"
			[attr.aria-required]="required() || null"
			(input)="value.set(textareaEl.value)"
			(blur)="blurred.emit()"
			class="flex min-h-[5rem] w-full rounded-[var(--mcms-radius)] border border-input bg-background px-2.5 py-2 font-sans text-sm
			       leading-snug text-foreground placeholder:text-muted-foreground
			       hover:not-disabled:not-focus-visible:border-foreground/25
			       focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
			       disabled:cursor-not-allowed disabled:opacity-50
			       aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive"
		></textarea>
	`,
	styles: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Textarea {
	// === FormValueControl implementation ===
	readonly value = model('');
	readonly disabled = input(false);
	readonly errors = input<readonly ValidationError[]>([]);
	readonly touched = input(false);
	readonly invalid = input(false);
	readonly readonly = input(false);
	readonly required = input(false);

	// === Component-specific configuration ===
	readonly id = input('');
	readonly name = input('');
	readonly placeholder = input('');
	readonly rows = input(3);
	readonly ariaLabel = input<string | undefined>(undefined);
	readonly describedBy = input<string | undefined>(undefined);

	/** Emitted when the textarea loses focus */
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

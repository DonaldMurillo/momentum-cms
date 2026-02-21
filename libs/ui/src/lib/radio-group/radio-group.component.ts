import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	input,
	model,
} from '@angular/core';
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
		'[attr.aria-label]': 'ariaLabel() || null',
		'[attr.aria-labelledby]': 'ariaLabelledBy() || null',
		'[attr.aria-required]': 'required() || null',
		'(keydown)': 'onKeydown($event)',
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
						[attr.tabindex]="focusableValue() === option.value ? 0 : -1"
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
	private readonly elementRef = inject(ElementRef<HTMLElement>);

	// === FormValueControl implementation ===
	readonly value = model('');
	readonly disabled = input(false);
	readonly errors = input<readonly ValidationError[]>([]);

	// === Component-specific configuration ===
	readonly id = input('');
	readonly name = input('');
	readonly options = input<RadioOption[]>([]);
	readonly ariaLabel = input<string | undefined>(undefined);
	readonly ariaLabelledBy = input<string | undefined>(undefined);
	readonly describedBy = input<string | undefined>(undefined);
	readonly required = input(false);

	// === Computed state ===
	readonly hasError = computed(() => this.errors().length > 0);

	readonly ariaDescribedBy = computed(() => {
		const parts: string[] = [];
		const described = this.describedBy();
		if (described) parts.push(described);
		if (this.hasError() && this.id()) parts.push(`${this.id()}-error`);
		return parts.length > 0 ? parts.join(' ') : null;
	});

	/** Determines which option value should receive tabindex="0" (roving tabindex). */
	protected readonly focusableValue = computed(() => {
		const current = this.value();
		const opts = this.options();
		if (current) {
			const currentOpt = opts.find((o) => o.value === current);
			if (currentOpt && !currentOpt.disabled) return current;
		}
		const first = opts.find((o) => !o.disabled);
		return first?.value ?? '';
	});

	selectOption(optionValue: string): void {
		if (!this.disabled()) {
			this.value.set(optionValue);
		}
	}

	protected onKeydown(event: KeyboardEvent): void {
		const enabledOpts = this.options().filter((o) => !o.disabled && !this.disabled());
		if (enabledOpts.length === 0) return;

		const currentIndex = enabledOpts.findIndex((o) => o.value === this.value());
		let newIndex: number;

		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				event.preventDefault();
				newIndex = currentIndex < enabledOpts.length - 1 ? currentIndex + 1 : 0;
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				event.preventDefault();
				newIndex = currentIndex > 0 ? currentIndex - 1 : enabledOpts.length - 1;
				break;
			default:
				return;
		}

		const newValue = enabledOpts[newIndex].value;
		this.value.set(newValue);

		// Focus the corresponding radio button
		const allOpts = this.options();
		const fullIndex = allOpts.findIndex((o) => o.value === newValue);
		const buttons = this.elementRef.nativeElement.querySelectorAll('button[role="radio"]');
		const button = buttons[fullIndex];
		if (button instanceof HTMLElement) {
			button.focus();
		}
	}
}

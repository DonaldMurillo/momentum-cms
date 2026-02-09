import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	Injector,
	input,
	model,
	viewChild,
} from '@angular/core';

/**
 * Input element for the command component.
 * Provides search/filter functionality for the command list.
 *
 * @example
 * ```html
 * <mcms-command-input placeholder="Search..." [(value)]="searchValue" [autofocus]="true" />
 * ```
 */
@Component({
	selector: 'mcms-command-input',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		<svg
			class="mr-2 h-4 w-4 shrink-0 opacity-50"
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="8"></circle>
			<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
		</svg>
		<input
			#inputEl
			type="text"
			[placeholder]="placeholder()"
			[class]="inputClasses()"
			[disabled]="disabled()"
			[value]="value()"
			(input)="onInput($event)"
			role="combobox"
			aria-autocomplete="list"
			[attr.aria-expanded]="ariaExpanded()"
			[attr.aria-controls]="ariaControls() || null"
			[attr.aria-label]="ariaLabel() || placeholder() || 'Search'"
		/>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandInput {
	private readonly injector = inject(Injector);
	private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

	/** Placeholder text for the input */
	readonly placeholder = input('');

	/** Current value of the input */
	readonly value = model('');

	/** Whether the input is disabled */
	readonly disabled = input(false);

	/** Whether to autofocus the input on mount */
	readonly autofocus = input(false);

	/** ID of the associated command list for aria-controls */
	readonly ariaControls = input('');

	/** Whether the associated list is expanded */
	readonly ariaExpanded = input(true);

	/** Accessible label for the input */
	readonly ariaLabel = input('');

	/** Additional CSS classes */
	readonly class = input('');

	constructor() {
		afterNextRender(
			() => {
				if (this.autofocus()) {
					this.inputEl()?.nativeElement.focus();
				}
			},
			{ injector: this.injector },
		);
	}

	protected readonly hostClasses = computed(() => {
		const base = 'flex items-center border-b px-3';
		return `${base} ${this.class()}`.trim();
	});

	protected readonly inputClasses = computed(() => {
		return 'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50';
	});

	protected onInput(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLInputElement) {
			this.value.set(target.value);
		}
	}
}

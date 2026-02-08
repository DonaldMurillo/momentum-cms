import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	model,
	output,
} from '@angular/core';

/**
 * A search input component with debounce support and clear functionality.
 *
 * @example
 * ```html
 * <mcms-search-input
 *   placeholder="Search users..."
 *   [debounce]="300"
 *   (searchChange)="onSearch($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-search-input',
	imports: [],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		<div
			class="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
			[class.opacity-50]="disabled()"
			[class.cursor-not-allowed]="disabled()"
		>
			<!-- Search icon -->
			<svg
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
				class="shrink-0 text-muted-foreground"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</svg>

			<!-- Native input (no border, fills remaining space) -->
			<input
				#inputEl
				type="text"
				[value]="value()"
				[placeholder]="placeholder()"
				[disabled]="disabled()"
				(input)="value.set(inputEl.value)"
				(keydown.escape)="onClear()"
				class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
			/>

			<!-- Clear button (44x44px touch target for mobile accessibility) -->
			@if (value() && !disabled()) {
				<button
					type="button"
					class="-mr-1 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
					(click)="onClear()"
					[attr.aria-label]="'Clear search'"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			}
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchInput {
	/** The current search value (two-way binding). */
	readonly value = model('');

	/** Placeholder text. */
	readonly placeholder = input('Search...');

	/** Debounce time in milliseconds before emitting search event. */
	readonly debounce = input(300);

	/** Whether the input is disabled. */
	readonly disabled = input(false);

	/** Additional CSS classes. */
	readonly class = input('');

	/** Emitted after debounce when search value changes. */
	readonly searchChange = output<string>();

	/** Emitted when the clear button is clicked. */
	readonly clear = output<void>();

	readonly hostClasses = computed(() => {
		const base = 'block';
		return `${base} ${this.class()}`.trim();
	});

	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		// Effect to handle debounced search
		effect(() => {
			const value = this.value();
			const debounceMs = this.debounce();

			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}

			this.debounceTimer = setTimeout(() => {
				this.searchChange.emit(value);
			}, debounceMs);
		});
	}

	onClear(): void {
		this.value.set('');
		this.clear.emit();
	}
}

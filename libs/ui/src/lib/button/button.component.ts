import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
} from '@angular/core';
import type { ButtonSize, ButtonVariant } from './button.types';

/**
 * Button component with multiple variants and sizes.
 *
 * Usage:
 * ```html
 * <button mcms-button>Default</button>
 * <button mcms-button variant="destructive">Delete</button>
 * <button mcms-button variant="outline" size="sm">Small</button>
 * <a mcms-button [disabled]="true">Disabled Link</a>
 * <button mcms-button [loading]="true">Saving...</button>
 * <button mcms-button size="icon" ariaLabel="Settings"><svg>...</svg></button>
 * ```
 */
@Component({
	selector: 'button[mcms-button], a[mcms-button]',
	host: {
		'[class]': 'class()',
		'[attr.disabled]': 'isNativeDisabled()',
		'[attr.aria-disabled]': 'isEffectivelyDisabled() || null',
		'[attr.aria-busy]': 'loading() || null',
		'[attr.data-size]': 'size()',
		'[style.--btn-bg]': 'variantBg()',
		'[style.--btn-color]': 'variantColor()',
		'[style.--btn-hover-bg]': 'variantHoverBg()',
		'[style.--btn-border]': 'variantBorder()',
		'[style.height]': 'sizeHeight()',
		'[style.padding]': 'sizePadding()',
		'[style.width]': 'sizeWidth()',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			white-space: nowrap;
			border-radius: var(--mcms-radius);
			font-family: var(--mcms-font-sans);
			font-size: var(--mcms-text-sm);
			font-weight: 500;
			letter-spacing: -0.005em;
			cursor: pointer;
			border: 1px solid var(--btn-border, transparent);
			background-color: var(--btn-bg);
			color: var(--btn-color);
			user-select: none;
		}
		:host(:hover:not([disabled]):not([aria-disabled='true'])) {
			background-color: var(--btn-hover-bg);
			border-color: var(--btn-hover-border, var(--btn-border, transparent));
		}
		:host(:active:not([disabled]):not([aria-disabled='true'])) {
			transform: translateY(0.5px);
		}
		:host(:focus-visible) {
			outline: none;
			box-shadow:
				0 0 0 2px hsl(var(--mcms-background)),
				0 0 0 3px hsl(var(--mcms-ring));
		}
		:host([disabled]),
		:host([aria-disabled='true']) {
			pointer-events: none;
			opacity: 0.5;
			cursor: not-allowed;
		}
		/* Touch devices: enforce a 44px tap target across every size variant.
		 * Inline [style.height] sets an exact height for desktop density; min-height
		 * wins on coarse pointers because it's the larger value, satisfying WCAG
		 * 2.5.5 AAA + Apple HIG without changing the editorial desktop layout. */
		@media (pointer: coarse) {
			:host {
				min-height: 2.75rem;
			}
			:host([data-size='icon']) {
				min-width: 2.75rem;
			}
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
	private readonly el = inject(ElementRef<HTMLElement>);

	/** Whether the host element is an anchor tag (determined once at construction). */
	private readonly isAnchor = this.el.nativeElement.tagName === 'A';

	readonly variant = input<ButtonVariant>('primary');
	readonly size = input<ButtonSize>('md');
	readonly disabled = input(false);
	readonly loading = input(false);
	readonly ariaLabel = input<string | undefined>(undefined);
	readonly class = input('');

	constructor() {
		effect(() => {
			const label = this.ariaLabel();
			if (label !== undefined) {
				this.el.nativeElement.setAttribute('aria-label', label);
			}
		});
	}

	/** Whether the button is effectively disabled (disabled or loading). */
	readonly isEffectivelyDisabled = computed(() => this.disabled() || this.loading());

	/**
	 * Native disabled attribute — only applied to `<button>` elements.
	 * `<a>` elements don't support `disabled`; they use `aria-disabled` instead.
	 */
	readonly isNativeDisabled = computed(() => {
		if (this.isAnchor) return null;
		return this.isEffectivelyDisabled() || null;
	});

	// Size styles — slightly tighter than before; the old md was 40px which is dashboard-bloat.
	readonly sizeHeight = computed(() => {
		switch (this.size()) {
			case 'sm':
				return '1.875rem'; /* 30 */
			case 'md':
				return '2.125rem'; /* 34 */
			case 'lg':
				return '2.5rem'; /* 40 */
			case 'icon':
				return '2.125rem';
		}
	});

	readonly sizePadding = computed(() => {
		switch (this.size()) {
			case 'sm':
				return '0 0.625rem';
			case 'md':
				return '0 0.875rem';
			case 'lg':
				return '0 1.25rem';
			case 'icon':
				return '0';
		}
	});

	readonly sizeWidth = computed(() => {
		return this.size() === 'icon' ? '2.125rem' : null;
	});

	// CSS variable values for variants
	readonly variantBg = computed(() => {
		const v = this.variant();
		switch (v) {
			case 'primary':
				return 'hsl(var(--mcms-primary))';
			case 'secondary':
				return 'hsl(var(--mcms-secondary))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive))';
			case 'outline':
				return 'hsl(var(--mcms-background))';
			case 'ghost':
			case 'link':
				return 'transparent';
		}
	});

	readonly variantColor = computed(() => {
		const v = this.variant();
		switch (v) {
			case 'primary':
				return 'hsl(var(--mcms-primary-foreground))';
			case 'secondary':
				return 'hsl(var(--mcms-secondary-foreground))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive-foreground))';
			case 'outline':
			case 'ghost':
				return 'hsl(var(--mcms-foreground))';
			case 'link':
				return 'hsl(var(--mcms-primary))';
		}
	});

	readonly variantHoverBg = computed(() => {
		const v = this.variant();
		switch (v) {
			case 'primary':
				/* Slightly darker on hover — color-mix in oklab for a true perceptual shift,
				 * not a transparency hack that bleeds the bg through. */
				return 'color-mix(in oklab, hsl(var(--mcms-primary)) 90%, hsl(var(--mcms-foreground)))';
			case 'secondary':
				return 'hsl(var(--mcms-accent))';
			case 'destructive':
				return 'color-mix(in oklab, hsl(var(--mcms-destructive)) 90%, hsl(var(--mcms-foreground)))';
			case 'outline':
				return 'hsl(var(--mcms-muted))';
			case 'ghost':
				return 'hsl(var(--mcms-muted))';
			case 'link':
				return 'transparent';
		}
	});

	readonly variantBorder = computed(() => {
		const v = this.variant();
		switch (v) {
			case 'outline':
				return 'hsl(var(--mcms-border))';
			default:
				return 'transparent';
		}
	});
}

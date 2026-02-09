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
			border-radius: 0.375rem;
			font-size: 0.875rem;
			font-weight: 500;
			transition:
				background-color 0.15s,
				color 0.15s,
				border-color 0.15s;
			cursor: pointer;
			border: 1px solid var(--btn-border, transparent);
			background-color: var(--btn-bg);
			color: var(--btn-color);
		}
		:host(:hover:not([disabled]):not([aria-disabled='true'])) {
			background-color: var(--btn-hover-bg);
		}
		:host(:focus-visible) {
			outline: none;
			box-shadow:
				0 0 0 2px hsl(var(--mcms-background)),
				0 0 0 4px hsl(var(--mcms-ring));
		}
		:host([disabled]),
		:host([aria-disabled='true']) {
			pointer-events: none;
			opacity: 0.5;
			cursor: not-allowed;
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

	// Size styles
	readonly sizeHeight = computed(() => {
		switch (this.size()) {
			case 'sm':
				return '2.25rem';
			case 'md':
				return '2.5rem';
			case 'lg':
				return '2.75rem';
			case 'icon':
				return '2.5rem';
		}
	});

	readonly sizePadding = computed(() => {
		switch (this.size()) {
			case 'sm':
				return '0 0.75rem';
			case 'md':
				return '0.5rem 1rem';
			case 'lg':
				return '0 2rem';
			case 'icon':
				return '0';
		}
	});

	readonly sizeWidth = computed(() => {
		return this.size() === 'icon' ? '2.5rem' : null;
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
				return 'hsl(var(--mcms-primary) / 0.9)';
			case 'secondary':
				return 'hsl(var(--mcms-secondary) / 0.8)';
			case 'destructive':
				return 'hsl(var(--mcms-destructive) / 0.9)';
			case 'outline':
			case 'ghost':
				return 'hsl(var(--mcms-accent))';
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

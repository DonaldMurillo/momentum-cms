import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { BadgeVariant } from './badge.types';

/**
 * Badge component for status indicators, counts, and labels.
 *
 * Usage:
 * ```html
 * <mcms-badge>Default</mcms-badge>
 * <mcms-badge variant="success">Active</mcms-badge>
 * <mcms-badge variant="destructive">Error</mcms-badge>
 * <mcms-badge variant="warning">Pending</mcms-badge>
 * ```
 */
@Component({
	selector: 'mcms-badge',
	host: {
		'[attr.role]': 'role() || null',
		'[attr.aria-label]': 'ariaLabel() || null',
		'[attr.data-tone]': 'tone()',
		'[style.--badge-bg]': 'variantBg()',
		'[style.--badge-color]': 'variantColor()',
		'[style.--badge-border]': 'variantBorder()',
		'[class]': 'hostClass()',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			border-radius: 999px;
			padding: 0.125rem 0.5rem 0.1875rem;
			font-size: var(--mcms-text-2xs);
			font-weight: 500;
			line-height: 1.2;
			letter-spacing: 0.01em;
			white-space: nowrap;
			background-color: var(--badge-bg);
			color: var(--badge-color);
			border: 1px solid var(--badge-border);
		}

		/* Status-dot prefix — purely typographic accent, used by 'success'/'warning'/'destructive'.
		 * The dot tints to the variant color so the chip itself can stay neutral. */
		:host([data-tone='success'])::before,
		:host([data-tone='warning'])::before,
		:host([data-tone='destructive'])::before {
			content: '';
			display: inline-block;
			width: 0.375rem;
			height: 0.375rem;
			border-radius: 999px;
			background-color: var(--badge-dot, currentColor);
			flex-shrink: 0;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
	readonly variant = input<BadgeVariant>('default');
	readonly class = input('');
	/** ARIA role. Set to 'status' for live-region badges, or null for decorative. */
	readonly role = input<string | null>(null);
	/** Accessible label for screen reader override. */
	readonly ariaLabel = input<string | undefined>(undefined);

	readonly hostClass = computed(() => this.class());

	/** Maps variant to a tone token used by the dot-prefix selector. */
	readonly tone = computed((): string | null => {
		switch (this.variant()) {
			case 'success':
			case 'warning':
			case 'destructive':
				return this.variant();
			default:
				return null;
		}
	});

	/* Soft, low-saturation chips with a tinted dot — quieter than filled pills,
	 * still readable, and the dot reads as semantic at a glance. */
	readonly variantBg = computed((): string => {
		switch (this.variant()) {
			case 'default':
				return 'hsl(var(--mcms-primary) / 0.12)';
			case 'secondary':
				return 'hsl(var(--mcms-secondary))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive) / 0.1)';
			case 'outline':
				return 'transparent';
			case 'success':
				return 'hsl(var(--mcms-success) / 0.12)';
			case 'warning':
				return 'hsl(var(--mcms-warning) / 0.18)';
		}
	});

	readonly variantColor = computed((): string => {
		/* Soft tinted chips need their text mixed toward the theme foreground or
		 * else saturated brand hues drop below WCAG AA's 4.5:1 against the 12-18%
		 * tinted backgrounds (axe-core flags this on the collection-list status
		 * badges in light mode). Mixing 60% of the brand hue with 40% foreground
		 * preserves the identity color while clearing AA in both themes. */
		switch (this.variant()) {
			case 'default':
				return 'color-mix(in oklab, hsl(var(--mcms-primary)) 60%, hsl(var(--mcms-foreground)))';
			case 'secondary':
				return 'hsl(var(--mcms-secondary-foreground))';
			case 'destructive':
				return 'color-mix(in oklab, hsl(var(--mcms-destructive)) 60%, hsl(var(--mcms-foreground)))';
			case 'outline':
				return 'hsl(var(--mcms-foreground))';
			case 'success':
				return 'color-mix(in oklab, hsl(var(--mcms-success)) 55%, hsl(var(--mcms-foreground)))';
			case 'warning':
				return 'color-mix(in oklab, hsl(var(--mcms-warning)) 50%, hsl(var(--mcms-foreground)))';
		}
	});

	readonly variantBorder = computed((): string => {
		switch (this.variant()) {
			case 'outline':
				return 'hsl(var(--mcms-border))';
			case 'success':
				return 'hsl(var(--mcms-success) / 0.25)';
			case 'warning':
				return 'hsl(var(--mcms-warning) / 0.4)';
			case 'destructive':
				return 'hsl(var(--mcms-destructive) / 0.22)';
			case 'default':
				return 'hsl(var(--mcms-primary) / 0.22)';
			default:
				return 'transparent';
		}
	});
}

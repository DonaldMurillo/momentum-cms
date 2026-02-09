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
		role: 'status',
		'[attr.aria-label]': 'ariaLabel() || null',
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
			border-radius: 9999px;
			padding: 0.125rem 0.625rem;
			font-size: 0.75rem;
			font-weight: 500;
			line-height: 1.25rem;
			white-space: nowrap;
			transition:
				background-color 0.15s,
				color 0.15s;
			background-color: var(--badge-bg);
			color: var(--badge-color);
			border: 1px solid var(--badge-border);
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
	readonly variant = input<BadgeVariant>('default');
	readonly class = input('');
	/** Accessible label for screen reader override. */
	readonly ariaLabel = input<string | undefined>(undefined);

	readonly hostClass = computed(() => this.class());

	readonly variantBg = computed((): string => {
		switch (this.variant()) {
			case 'default':
				return 'hsl(var(--mcms-primary))';
			case 'secondary':
				return 'hsl(var(--mcms-secondary))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive))';
			case 'outline':
				return 'transparent';
			case 'success':
				return 'hsl(var(--mcms-success))';
			case 'warning':
				return 'hsl(var(--mcms-warning))';
		}
	});

	readonly variantColor = computed((): string => {
		switch (this.variant()) {
			case 'default':
				return 'hsl(var(--mcms-primary-foreground))';
			case 'secondary':
				return 'hsl(var(--mcms-secondary-foreground))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive-foreground))';
			case 'outline':
				return 'hsl(var(--mcms-foreground))';
			case 'success':
				return 'hsl(var(--mcms-success-foreground))';
			case 'warning':
				return 'hsl(var(--mcms-warning-foreground))';
		}
	});

	readonly variantBorder = computed((): string => {
		switch (this.variant()) {
			case 'outline':
				return 'hsl(var(--mcms-border))';
			default:
				return 'transparent';
		}
	});
}

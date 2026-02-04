import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AlertVariant } from './alert.types';

/**
 * Alert component for displaying important messages.
 *
 * Usage:
 * ```html
 * <mcms-alert>
 *   <mcms-alert-title>Heads up!</mcms-alert-title>
 *   <mcms-alert-description>
 *     You can add components to your app using the cli.
 *   </mcms-alert-description>
 * </mcms-alert>
 *
 * <mcms-alert variant="destructive">
 *   <mcms-alert-title>Error</mcms-alert-title>
 *   <mcms-alert-description>Something went wrong.</mcms-alert-description>
 * </mcms-alert>
 * ```
 */
@Component({
	selector: 'mcms-alert',
	host: {
		role: 'alert',
		'[attr.aria-live]': 'ariaLive()',
		'[style.--alert-bg]': 'variantBg()',
		'[style.--alert-border]': 'variantBorder()',
		'[style.--alert-color]': 'variantColor()',
		'[style.--alert-icon-color]': 'variantIconColor()',
		'[class]': 'hostClass()',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			position: relative;
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			width: 100%;
			border-radius: 0.5rem;
			border: 1px solid var(--alert-border);
			padding: 1rem;
			background-color: var(--alert-bg);
			color: var(--alert-color);
		}

		:host ::ng-deep [data-alert-icon] {
			position: absolute;
			left: 1rem;
			top: 1rem;
			color: var(--alert-icon-color);
			width: 1rem;
			height: 1rem;
		}

		:host ::ng-deep mcms-alert-title,
		:host ::ng-deep mcms-alert-description {
			padding-left: 1.75rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alert {
	readonly variant = input<AlertVariant>('default');
	readonly class = input('');

	readonly hostClass = computed(() => this.class());

	readonly ariaLive = computed((): 'assertive' | 'polite' =>
		this.variant() === 'destructive' ? 'assertive' : 'polite',
	);

	readonly variantBg = computed((): string => {
		switch (this.variant()) {
			case 'default':
				return 'hsl(var(--mcms-background))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive) / 0.1)';
			case 'success':
				return 'hsl(var(--mcms-success) / 0.1)';
			case 'warning':
				return 'hsl(var(--mcms-warning) / 0.1)';
			case 'info':
				return 'hsl(var(--mcms-info) / 0.1)';
		}
	});

	readonly variantBorder = computed((): string => {
		switch (this.variant()) {
			case 'default':
				return 'hsl(var(--mcms-border))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive) / 0.5)';
			case 'success':
				return 'hsl(var(--mcms-success) / 0.5)';
			case 'warning':
				return 'hsl(var(--mcms-warning) / 0.5)';
			case 'info':
				return 'hsl(var(--mcms-info) / 0.5)';
		}
	});

	readonly variantColor = computed((): string => {
		switch (this.variant()) {
			case 'default':
				return 'hsl(var(--mcms-foreground))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive))';
			case 'success':
				return 'hsl(var(--mcms-success))';
			case 'warning':
				return 'hsl(var(--mcms-warning))';
			case 'info':
				return 'hsl(var(--mcms-info))';
		}
	});

	readonly variantIconColor = computed((): string => this.variantColor());
}

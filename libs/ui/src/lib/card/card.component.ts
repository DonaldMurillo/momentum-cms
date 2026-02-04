import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Card container component.
 *
 * Usage:
 * ```html
 * <mcms-card>
 *   <mcms-card-header>
 *     <mcms-card-title>Title</mcms-card-title>
 *     <mcms-card-description>Description</mcms-card-description>
 *   </mcms-card-header>
 *   <mcms-card-content>Content here</mcms-card-content>
 *   <mcms-card-footer>Footer</mcms-card-footer>
 * </mcms-card>
 * ```
 */
@Component({
	selector: 'mcms-card',
	host: {
		class: 'block',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			border-radius: 0.75rem;
			border: 1px solid hsl(var(--mcms-border));
			background-color: hsl(var(--mcms-card));
			color: hsl(var(--mcms-card-foreground));
			box-shadow:
				0 1px 3px 0 rgb(0 0 0 / 0.1),
				0 1px 2px -1px rgb(0 0 0 / 0.1);
			transition:
				box-shadow 0.2s ease,
				border-color 0.2s ease;
		}

		:host(:hover) {
			box-shadow:
				0 4px 6px -1px rgb(0 0 0 / 0.1),
				0 2px 4px -2px rgb(0 0 0 / 0.1);
			border-color: hsl(var(--mcms-border) / 0.8);
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Card {}

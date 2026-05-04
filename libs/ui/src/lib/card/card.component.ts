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
			border-radius: var(--mcms-radius);
			border: 1px solid hsl(var(--mcms-border));
			background-color: hsl(var(--mcms-card));
			color: hsl(var(--mcms-card-foreground));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Card {}

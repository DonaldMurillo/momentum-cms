import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Popover content container component.
 *
 * Usage:
 * ```html
 * <mcms-popover-content>
 *   <p>Content goes here</p>
 * </mcms-popover-content>
 * ```
 */
@Component({
	selector: 'mcms-popover-content',
	host: {
		class: 'block',
		role: 'dialog',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			z-index: 50;
			min-width: 8rem;
			overflow: hidden;
			border-radius: 0.375rem;
			border: 1px solid hsl(var(--mcms-border));
			background-color: hsl(var(--mcms-card));
			color: hsl(var(--mcms-card-foreground));
			padding: 0.25rem;
			box-shadow:
				0 10px 15px -3px rgb(0 0 0 / 0.1),
				0 4px 6px -4px rgb(0 0 0 / 0.1);
			animation: popover-in 0.15s ease-out;
		}

		@keyframes popover-in {
			from {
				opacity: 0;
				transform: scale(0.95);
			}
			to {
				opacity: 1;
				transform: scale(1);
			}
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverContent {}

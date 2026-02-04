import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Internal tooltip content component rendered via CDK portal.
 */
@Component({
	selector: 'mcms-tooltip-content',
	host: {
		role: 'tooltip',
		'[id]': 'id()',
	},
	template: `{{ content() }}`,
	styles: `
		:host {
			display: block;
			padding: 0.375rem 0.75rem;
			font-size: 0.75rem;
			line-height: 1.25rem;
			color: hsl(var(--mcms-primary-foreground));
			background-color: hsl(var(--mcms-foreground));
			border-radius: 0.375rem;
			box-shadow:
				0 4px 6px -1px rgb(0 0 0 / 0.1),
				0 2px 4px -2px rgb(0 0 0 / 0.1);
			animation: tooltip-in 0.15s ease-out;
			max-width: 20rem;
			word-wrap: break-word;
		}

		@keyframes tooltip-in {
			from {
				opacity: 0;
				transform: scale(0.96);
			}
			to {
				opacity: 1;
				transform: scale(1);
			}
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TooltipContent {
	readonly content = input.required<string>();
	readonly id = input.required<string>();
}

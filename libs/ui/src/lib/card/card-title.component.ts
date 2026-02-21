import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Card title component that renders as an ARIA heading.
 *
 * Uses `role="heading"` with `aria-level` on the host element instead of
 * native heading elements inside `@switch` blocks. This avoids Angular SSR
 * hydration issues where `<ng-content />` inside control flow blocks causes
 * projected content to be dropped during client-side hydration.
 */
@Component({
	selector: 'mcms-card-title',
	host: {
		role: 'heading',
		'[attr.aria-level]': 'level()',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			font-size: 1.5rem;
			font-weight: 600;
			line-height: 1;
			letter-spacing: -0.025em;
			margin: 0;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardTitle {
	/** Heading level (1-4). Defaults to 2 for proper document hierarchy. */
	readonly level = input<1 | 2 | 3 | 4>(2);
}

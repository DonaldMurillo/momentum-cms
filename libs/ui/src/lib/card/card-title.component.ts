import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
	selector: 'mcms-card-title',
	host: {
		class: 'contents',
	},
	template: `
		@switch (level()) {
			@case (1) {
				<h1 class="card-title"><ng-content /></h1>
			}
			@case (2) {
				<h2 class="card-title"><ng-content /></h2>
			}
			@case (3) {
				<h3 class="card-title"><ng-content /></h3>
			}
			@case (4) {
				<h4 class="card-title"><ng-content /></h4>
			}
			@default {
				<h2 class="card-title"><ng-content /></h2>
			}
		}
	`,
	styles: `
		.card-title {
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

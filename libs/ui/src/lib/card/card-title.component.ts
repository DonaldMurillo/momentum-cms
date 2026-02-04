import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'mcms-card-title',
	host: { class: 'contents' },
	template: `
		<h2 class="card-title">
			<ng-content />
		</h2>
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
export class CardTitle {}

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'mcms-card-header',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			padding: 1.25rem 1.25rem 1rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardHeader {}

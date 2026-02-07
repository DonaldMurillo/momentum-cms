import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'mcms-card-content',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			padding: 1.5rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardContent {}

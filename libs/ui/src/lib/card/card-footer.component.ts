import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'mcms-card-footer',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: flex;
			align-items: center;
			padding: 0 1.5rem 1.5rem 1.5rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFooter {}

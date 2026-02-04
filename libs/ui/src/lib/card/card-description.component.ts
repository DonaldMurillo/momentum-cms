import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'mcms-card-description',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			font-size: 0.875rem;
			color: hsl(var(--mcms-muted-foreground));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDescription {}

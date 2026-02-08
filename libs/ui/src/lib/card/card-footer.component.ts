import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'mcms-card-footer',
	host: { class: 'flex items-center p-6' },
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFooter {}

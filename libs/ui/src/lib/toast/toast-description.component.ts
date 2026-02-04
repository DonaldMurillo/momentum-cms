import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Toast description component (optional, for custom content).
 */
@Component({
	selector: 'mcms-toast-description',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			margin-top: 0.25rem;
			font-size: 0.875rem;
			line-height: 1.25rem;
			opacity: 0.9;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastDescription {}

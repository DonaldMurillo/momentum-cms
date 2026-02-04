import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Toast title component (optional, for custom content).
 */
@Component({
	selector: 'mcms-toast-title',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			font-weight: 500;
			font-size: 0.875rem;
			line-height: 1.25rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastTitle {}

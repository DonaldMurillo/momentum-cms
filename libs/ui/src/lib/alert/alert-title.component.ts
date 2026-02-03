import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Alert title component.
 *
 * Usage:
 * ```html
 * <mcms-alert-title>Important!</mcms-alert-title>
 * ```
 */
@Component({
	selector: 'mcms-alert-title',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			margin-bottom: 0.25rem;
			font-weight: 500;
			line-height: 1.375;
			letter-spacing: -0.025em;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertTitle {}

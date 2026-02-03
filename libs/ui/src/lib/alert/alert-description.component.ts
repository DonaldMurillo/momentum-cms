import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Alert description component.
 *
 * Usage:
 * ```html
 * <mcms-alert-description>
 *   This is a detailed description of the alert.
 * </mcms-alert-description>
 * ```
 */
@Component({
	selector: 'mcms-alert-description',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			font-size: 0.875rem;
			line-height: 1.5;
			opacity: 0.9;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertDescription {}

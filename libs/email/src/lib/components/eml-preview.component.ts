import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Hidden preview text shown in email client list view.
 * Content is visually hidden but readable by email clients.
 */
@Component({
	selector: 'eml-preview',
	template: `
		<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
			<ng-content />
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlPreview {}

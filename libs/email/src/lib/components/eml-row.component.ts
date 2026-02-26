import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
	selector: 'eml-row',
	template: `
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
			<tr>
				<ng-content />
			</tr>
		</table>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlRow {}

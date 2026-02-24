/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-section',
	template: `
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
			<tr>
				<td [attr.style]="cellStyle">
					<ng-content />
				</td>
			</tr>
		</table>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlSection {
	@Input() padding = '0';

	get cellStyle(): string {
		return `padding: ${this.padding};`;
	}
}

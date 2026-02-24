/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-body',
	template: `
		<table
			role="presentation"
			width="100%"
			cellspacing="0"
			cellpadding="0"
			[attr.style]="tableStyle"
		>
			<tr>
				<td [attr.style]="cellStyle">
					<ng-content />
				</td>
			</tr>
		</table>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlBody {
	@Input() backgroundColor = '#f4f4f5';
	@Input() fontFamily =
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
	@Input() padding = '40px 20px';

	get tableStyle(): string {
		return `background-color: ${this.backgroundColor}; font-family: ${this.fontFamily}; line-height: 1.6; margin: 0; padding: 0;`;
	}

	get cellStyle(): string {
		return `padding: ${this.padding};`;
	}
}

/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-container',
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
export class EmlContainer {
	@Input() maxWidth = '480px';
	@Input() backgroundColor = '#ffffff';
	@Input() borderRadius = '8px';
	@Input() padding = '40px';
	@Input() shadow = '0 1px 3px rgba(0,0,0,0.1)';

	get tableStyle(): string {
		return `max-width: ${this.maxWidth}; margin: 0 auto; background-color: ${this.backgroundColor}; border-radius: ${this.borderRadius}; box-shadow: ${this.shadow};`;
	}

	get cellStyle(): string {
		return `padding: ${this.padding};`;
	}
}

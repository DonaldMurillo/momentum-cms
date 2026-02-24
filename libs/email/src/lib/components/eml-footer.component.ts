/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-footer',
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
export class EmlFooter {
	@Input() maxWidth = '480px';
	@Input() color = '#71717a';
	@Input() fontSize = '12px';
	@Input() textAlign: 'left' | 'center' | 'right' = 'center';
	@Input() padding = '20px 0 0';

	get tableStyle(): string {
		return `max-width: ${this.maxWidth}; margin: 0 auto;`;
	}

	get cellStyle(): string {
		return `text-align: ${this.textAlign}; color: ${this.color}; font-size: ${this.fontSize}; padding: ${this.padding};`;
	}
}

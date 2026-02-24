/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-button',
	template: `
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
			<tr>
				<td [attr.style]="alignStyle">
					<a [attr.href]="href" [attr.style]="linkStyle" target="_blank">
						<ng-content />
					</a>
				</td>
			</tr>
		</table>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlButton {
	@Input() href = '';
	@Input() backgroundColor = '#18181b';
	@Input() color = '#ffffff';
	@Input() borderRadius = '6px';
	@Input() padding = '12px 24px';
	@Input() textAlign: 'left' | 'center' | 'right' = 'left';

	get alignStyle(): string {
		return `padding: 0; text-align: ${this.textAlign};`;
	}

	get linkStyle(): string {
		return `display: inline-block; padding: ${this.padding}; background-color: ${this.backgroundColor}; color: ${this.color}; text-decoration: none; border-radius: ${this.borderRadius}; font-weight: 500;`;
	}
}

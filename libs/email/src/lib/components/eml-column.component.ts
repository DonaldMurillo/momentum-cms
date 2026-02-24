/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-column',
	template: `
		<td [attr.style]="cellStyle" [attr.width]="width" valign="top">
			<ng-content />
		</td>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlColumn {
	@Input() width: string | undefined = undefined;
	@Input() padding = '0';
	@Input() verticalAlign = 'top';

	get cellStyle(): string {
		return `padding: ${this.padding}; vertical-align: ${this.verticalAlign};`;
	}
}

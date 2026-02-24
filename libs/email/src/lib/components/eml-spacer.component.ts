/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-spacer',
	template: `<div [attr.style]="spacerStyle"></div>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlSpacer {
	@Input() height = '24px';

	get spacerStyle(): string {
		return `height: ${this.height}; line-height: ${this.height}; font-size: 1px;`;
	}
}

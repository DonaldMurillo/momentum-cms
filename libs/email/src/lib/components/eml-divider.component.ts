/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-divider',
	template: `<hr [attr.style]="hrStyle" />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlDivider {
	@Input() color = '#e4e4e7';
	@Input() margin = '24px 0';

	get hrStyle(): string {
		return `border: none; border-top: 1px solid ${this.color}; margin: ${this.margin};`;
	}
}

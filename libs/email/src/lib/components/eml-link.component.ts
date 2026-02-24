/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-link',
	template: `
		<a [attr.href]="href" [attr.style]="linkStyle" target="_blank">
			<ng-content />
		</a>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlLink {
	@Input() href = '';
	@Input() color = '#18181b';
	@Input() textDecoration = 'underline';

	get linkStyle(): string {
		return `color: ${this.color}; text-decoration: ${this.textDecoration};`;
	}
}

/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-text',
	template: `
		<p [attr.style]="pStyle">
			<ng-content />
		</p>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlText {
	@Input() color = '#3f3f46';
	@Input() fontSize = '16px';
	@Input() lineHeight = '1.6';
	@Input() margin = '0 0 16px';
	@Input() textAlign: 'left' | 'center' | 'right' = 'left';

	get pStyle(): string {
		return `margin: ${this.margin}; color: ${this.color}; font-size: ${this.fontSize}; line-height: ${this.lineHeight}; text-align: ${this.textAlign};`;
	}
}

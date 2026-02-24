/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-heading',
	template: `<div [attr.style]="headingStyle" [attr.role]="'heading'" [attr.aria-level]="level">
		<ng-content />
	</div>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlHeading {
	@Input() level: 1 | 2 | 3 = 1;
	@Input() color = '#18181b';
	@Input() margin = '0 0 24px';
	@Input() textAlign: 'left' | 'center' | 'right' = 'left';

	private readonly fontSizeMap: Record<number, string> = {
		1: '24px',
		2: '20px',
		3: '16px',
	};

	get headingStyle(): string {
		return `margin: ${this.margin}; font-size: ${this.fontSizeMap[this.level] ?? '24px'}; font-weight: 600; color: ${this.color}; text-align: ${this.textAlign};`;
	}
}

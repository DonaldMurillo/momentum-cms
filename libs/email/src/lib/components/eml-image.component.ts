/* eslint-disable local/no-legacy-angular-decorators -- JIT mode (renderApplication) requires @Input() decorators */
import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
	selector: 'eml-image',
	template: `
		<img
			[attr.src]="src"
			[attr.alt]="alt"
			[attr.width]="width"
			[attr.height]="height"
			[attr.style]="imgStyle"
		/>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlImage {
	@Input() src = '';
	@Input() alt = '';
	@Input() width: string | undefined = undefined;
	@Input() height: string | undefined = undefined;
	@Input() borderRadius = '0';

	get imgStyle(): string {
		return `display: block; max-width: 100%; border: 0; outline: none; border-radius: ${this.borderRadius};`;
	}
}

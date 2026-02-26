import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-column',
	template: `
		<td [attr.style]="cellStyle()" [attr.width]="width()" valign="top">
			<ng-content />
		</td>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlColumn {
	readonly width = input<string | undefined>(undefined);
	readonly padding = input('0');
	readonly verticalAlign = input('top');

	readonly cellStyle = computed(
		() => `padding: ${this.padding()}; vertical-align: ${this.verticalAlign()};`,
	);
}

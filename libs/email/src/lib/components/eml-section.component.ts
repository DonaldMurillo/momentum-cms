import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-section',
	template: `
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
			<tr>
				<td [attr.style]="cellStyle()">
					<ng-content />
				</td>
			</tr>
		</table>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlSection {
	readonly padding = input('0');

	readonly cellStyle = computed(() => `padding: ${this.padding()};`);
}

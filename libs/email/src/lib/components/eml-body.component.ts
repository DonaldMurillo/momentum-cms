import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-body',
	template: `
		<table
			role="presentation"
			width="100%"
			cellspacing="0"
			cellpadding="0"
			[attr.style]="tableStyle()"
		>
			<tr>
				<td [attr.style]="cellStyle()">
					<ng-content />
				</td>
			</tr>
		</table>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlBody {
	readonly backgroundColor = input('#f4f4f5');
	readonly fontFamily = input(
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
	);
	readonly padding = input('40px 20px');

	readonly tableStyle = computed(
		() =>
			`background-color: ${this.backgroundColor()}; font-family: ${this.fontFamily()}; line-height: 1.6; margin: 0; padding: 0;`,
	);

	readonly cellStyle = computed(() => `padding: ${this.padding()};`);
}

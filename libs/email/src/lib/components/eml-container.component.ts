import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-container',
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
export class EmlContainer {
	readonly maxWidth = input('480px');
	readonly backgroundColor = input('#ffffff');
	readonly borderRadius = input('8px');
	readonly padding = input('40px');
	readonly shadow = input('0 1px 3px rgba(0,0,0,0.1)');

	readonly tableStyle = computed(
		() =>
			`max-width: ${this.maxWidth()}; margin: 0 auto; background-color: ${this.backgroundColor()}; border-radius: ${this.borderRadius()}; box-shadow: ${this.shadow()};`,
	);

	readonly cellStyle = computed(() => `padding: ${this.padding()};`);
}

import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-footer',
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
export class EmlFooter {
	readonly maxWidth = input('480px');
	readonly color = input('#71717a');
	readonly fontSize = input('12px');
	readonly textAlign = input<'left' | 'center' | 'right'>('center');
	readonly padding = input('20px 0 0');

	readonly tableStyle = computed(() => `max-width: ${this.maxWidth()}; margin: 0 auto;`);

	readonly cellStyle = computed(
		() =>
			`text-align: ${this.textAlign()}; color: ${this.color()}; font-size: ${this.fontSize()}; padding: ${this.padding()};`,
	);
}

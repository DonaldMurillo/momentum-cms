import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-button',
	template: `
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
			<tr>
				<td [attr.style]="alignStyle()">
					<a [attr.href]="href()" [attr.style]="linkStyle()" target="_blank">
						<ng-content />
					</a>
				</td>
			</tr>
		</table>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlButton {
	readonly href = input('');
	readonly backgroundColor = input('#18181b');
	readonly color = input('#ffffff');
	readonly borderRadius = input('6px');
	readonly padding = input('12px 24px');
	readonly textAlign = input<'left' | 'center' | 'right'>('left');

	readonly alignStyle = computed(() => `padding: 0; text-align: ${this.textAlign()};`);

	readonly linkStyle = computed(
		() =>
			`display: inline-block; padding: ${this.padding()}; background-color: ${this.backgroundColor()}; color: ${this.color()}; text-decoration: none; border-radius: ${this.borderRadius()}; font-weight: 500;`,
	);
}

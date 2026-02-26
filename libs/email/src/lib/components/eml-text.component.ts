import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-text',
	template: `
		<p [attr.style]="pStyle()">
			<ng-content />
		</p>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlText {
	readonly color = input('#3f3f46');
	readonly fontSize = input('16px');
	readonly lineHeight = input('1.6');
	readonly margin = input('0 0 16px');
	readonly textAlign = input<'left' | 'center' | 'right'>('left');

	readonly pStyle = computed(
		() =>
			`margin: ${this.margin()}; color: ${this.color()}; font-size: ${this.fontSize()}; line-height: ${this.lineHeight()}; text-align: ${this.textAlign()};`,
	);
}

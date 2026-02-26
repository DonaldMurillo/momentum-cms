import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-heading',
	template: `<div [attr.style]="headingStyle()" [attr.role]="'heading'" [attr.aria-level]="level()">
		<ng-content />
	</div>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlHeading {
	readonly level = input<1 | 2 | 3>(1);
	readonly color = input('#18181b');
	readonly margin = input('0 0 24px');
	readonly textAlign = input<'left' | 'center' | 'right'>('left');

	private readonly fontSizeMap: Record<1 | 2 | 3, string> = {
		1: '24px',
		2: '20px',
		3: '16px',
	};

	readonly headingStyle = computed(
		() =>
			`margin: ${this.margin()}; font-size: ${this.fontSizeMap[this.level()] ?? '24px'}; font-weight: 600; color: ${this.color()}; text-align: ${this.textAlign()};`,
	);
}

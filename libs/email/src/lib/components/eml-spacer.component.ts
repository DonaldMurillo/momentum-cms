import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-spacer',
	template: `<div [attr.style]="spacerStyle()"></div>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlSpacer {
	readonly height = input('24px');

	readonly spacerStyle = computed(
		() => `height: ${this.height()}; line-height: ${this.height()}; font-size: 1px;`,
	);
}

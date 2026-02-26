import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-divider',
	template: `<hr [attr.style]="hrStyle()" />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlDivider {
	readonly color = input('#e4e4e7');
	readonly margin = input('24px 0');

	readonly hrStyle = computed(
		() => `border: none; border-top: 1px solid ${this.color()}; margin: ${this.margin()};`,
	);
}

import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-link',
	template: `
		<a [attr.href]="href()" [attr.style]="linkStyle()" target="_blank">
			<ng-content />
		</a>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlLink {
	readonly href = input('');
	readonly color = input('#18181b');
	readonly textDecoration = input('underline');

	readonly linkStyle = computed(
		() => `color: ${this.color()}; text-decoration: ${this.textDecoration()};`,
	);
}

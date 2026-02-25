import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
	selector: 'eml-image',
	template: `
		<img
			[attr.src]="src()"
			[attr.alt]="alt()"
			[attr.width]="width()"
			[attr.height]="height()"
			[attr.style]="imgStyle()"
		/>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmlImage {
	readonly src = input('');
	readonly alt = input('');
	readonly width = input<string | undefined>(undefined);
	readonly height = input<string | undefined>(undefined);
	readonly borderRadius = input('0');

	readonly imgStyle = computed(
		() =>
			`display: block; max-width: 100%; border: 0; outline: none; border-radius: ${this.borderRadius()};`,
	);
}

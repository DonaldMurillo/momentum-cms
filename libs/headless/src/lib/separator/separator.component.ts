import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
	selector: 'hdl-separator',
	host: {
		'[attr.data-slot]': '"separator"',
		'[attr.data-orientation]': 'orientation()',
		'[attr.role]': 'decorative() ? "presentation" : "separator"',
		'[attr.aria-orientation]': 'decorative() ? null : orientation()',
	},
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSeparator {
	readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
	readonly decorative = input(true);
}

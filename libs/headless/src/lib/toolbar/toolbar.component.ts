import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { Toolbar } from '@angular/aria/toolbar';

@Component({
	selector: 'hdl-toolbar',
	host: {
		'[attr.data-slot]': '"toolbar"',
		'[attr.data-orientation]': 'orientation()',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
	hostDirectives: [
		{
			directive: Toolbar,
			inputs: ['orientation', 'disabled', 'wrap', 'softDisabled', 'values'],
			outputs: ['valuesChange'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToolbar {
	readonly ariaDirective = inject(Toolbar);
	readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
	readonly disabled = input(false);
	readonly wrap = input(true);
	readonly values = model<string[]>([]);
}

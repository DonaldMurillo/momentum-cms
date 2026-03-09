import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
	selector: 'hdl-tooltip-content',
	host: {
		'[attr.data-slot]': '"tooltip-content"',
		role: 'tooltip',
		'[id]': 'id()',
	},
	template: `{{ content() }}`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTooltipContent {
	readonly content = input('');
	readonly id = input('');
}

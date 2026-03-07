import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
	selector: 'hdl-tooltip-content',
	host: {
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

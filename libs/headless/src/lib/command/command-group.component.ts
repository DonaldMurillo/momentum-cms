import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
	selector: 'hdl-command-group',
	host: {
		'[attr.data-slot]': '"command-group"',
		'[attr.aria-label]': 'label()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCommandGroup {
	readonly label = input<string | null>(null);
}

import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { MenuBar } from '@angular/aria/menu';

@Component({
	selector: 'hdl-menu-bar',
	hostDirectives: [
		{
			directive: MenuBar,
			inputs: ['disabled', 'wrap', 'typeaheadDelay', 'values'],
			outputs: ['valuesChange'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlMenuBar {
	readonly menuBar = inject(MenuBar);
	readonly disabled = input(false);
	readonly wrap = input(true);
	readonly typeaheadDelay = input(500);
	readonly values = model<string[]>([]);
}

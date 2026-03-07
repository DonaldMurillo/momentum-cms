import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ToolbarWidgetGroup } from '@angular/aria/toolbar';

@Component({
	selector: 'hdl-toolbar-widget-group',
	hostDirectives: [
		{
			directive: ToolbarWidgetGroup,
			inputs: ['disabled', 'multi'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToolbarWidgetGroup {
	readonly group = inject(ToolbarWidgetGroup);
	readonly disabled = input(false);
	readonly multi = input(false);
}

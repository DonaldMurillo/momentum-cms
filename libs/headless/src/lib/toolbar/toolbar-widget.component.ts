import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ToolbarWidget } from '@angular/aria/toolbar';

@Component({
	selector: 'button[hdl-toolbar-widget]',
	host: {
		'[attr.data-slot]': '"toolbar-widget"',
		'[attr.data-active]': 'widget.active() ? "true" : null',
		'[attr.data-state]': 'widget.selected() ? "selected" : "unselected"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
	hostDirectives: [
		{
			directive: ToolbarWidget,
			inputs: ['value', 'disabled'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToolbarWidget {
	readonly widget = inject(ToolbarWidget);
	readonly value = input.required<string>();
	readonly disabled = input(false);
}

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { GridCell } from '@angular/aria/grid';

@Component({
	selector: 'hdl-grid-cell',
	host: {
		'[attr.data-slot]': '"grid-cell"',
		'[attr.data-state]': 'gridCell.selected() ? "selected" : "unselected"',
		'[attr.data-active]': 'gridCell.active() ? "true" : null',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
	hostDirectives: [
		{
			directive: GridCell,
			inputs: ['disabled'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlGridCell {
	readonly gridCell = inject(GridCell);
	readonly disabled = input(false);
}

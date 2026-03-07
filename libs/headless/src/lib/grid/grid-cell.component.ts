import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { GridCell } from '@angular/aria/grid';

@Component({
	selector: 'hdl-grid-cell',
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

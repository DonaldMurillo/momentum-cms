import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GridRow } from '@angular/aria/grid';

@Component({
	selector: 'hdl-grid-row',
	host: {
		'[attr.data-slot]': '"grid-row"',
	},
	hostDirectives: [GridRow],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlGridRow {
	readonly gridRow = inject(GridRow);
}

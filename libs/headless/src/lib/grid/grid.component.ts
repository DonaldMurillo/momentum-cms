import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Grid } from '@angular/aria/grid';

@Component({
	selector: 'hdl-grid',
	hostDirectives: [
		{
			directive: Grid,
			inputs: ['enableSelection', 'disabled', 'softDisabled', 'focusMode'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlGrid {
	readonly grid = inject(Grid);
	readonly enableSelection = input(false);
	readonly disabled = input(false);
	readonly softDisabled = input(false);
	readonly focusMode = input<'roving' | 'activedescendant'>('roving');
}

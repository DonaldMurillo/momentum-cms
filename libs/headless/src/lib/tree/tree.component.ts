import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { Tree } from '@angular/aria/tree';

@Component({
	selector: 'hdl-tree',
	exportAs: 'hdlTree',
	hostDirectives: [
		{
			directive: Tree,
			inputs: ['multi', 'selectionMode', 'disabled', 'wrap', 'orientation', 'values'],
			outputs: ['valuesChange'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTree {
	readonly tree = inject(Tree);
	readonly multi = input(false);
	readonly selectionMode = input<'follow' | 'explicit'>('explicit');
	readonly disabled = input(false);
	readonly wrap = input(true);
	readonly orientation = input<'horizontal' | 'vertical'>('vertical');
	readonly values = model<string[]>([]);
}

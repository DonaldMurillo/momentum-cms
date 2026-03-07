import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { Listbox } from '@angular/aria/listbox';

@Component({
	selector: 'hdl-listbox',
	hostDirectives: [
		{
			directive: Listbox,
			inputs: ['multi', 'disabled', 'orientation', 'wrap', 'selectionMode', 'values'],
			outputs: ['valuesChange'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlListbox {
	readonly listbox = inject(Listbox);
	readonly multi = input(false);
	readonly disabled = input(false);
	readonly orientation = input<'horizontal' | 'vertical'>('vertical');
	readonly wrap = input(true);
	readonly selectionMode = input<'follow' | 'explicit'>('explicit');
	readonly values = model<string[]>([]);
}

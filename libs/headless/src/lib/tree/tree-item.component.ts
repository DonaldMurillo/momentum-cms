import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { TreeItem, Tree, TreeItemGroup } from '@angular/aria/tree';

@Component({
	selector: 'hdl-tree-item',
	exportAs: 'hdlTreeItem',
	hostDirectives: [
		{
			directive: TreeItem,
			inputs: ['value', 'parent', 'disabled', 'expanded', 'label', 'selectable'],
			outputs: ['expandedChange'],
		},
	],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTreeItem {
	readonly treeItem = inject(TreeItem);
	readonly value = input.required<string>();
	readonly parent = input.required<Tree<string> | TreeItemGroup<string>>();
	readonly label = input<string>();
	readonly disabled = input(false);
	readonly expanded = model(false);
	readonly selectable = input(true);
}

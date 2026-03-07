import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TreeItemGroup, TreeItem } from '@angular/aria/tree';

@Component({
	selector: 'hdl-tree-item-group',
	exportAs: 'hdlTreeItemGroup',
	hostDirectives: [
		{
			directive: TreeItemGroup,
			inputs: ['ownedBy'],
		},
	],
	host: {
		'[hidden]': '!isExpanded()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTreeItemGroup {
	readonly group = inject(TreeItemGroup);
	readonly ownedBy = input.required<TreeItem<string>>();

	readonly isExpanded = computed(() => {
		const owner = this.ownedBy();
		return owner?.expanded() ?? false;
	});
}

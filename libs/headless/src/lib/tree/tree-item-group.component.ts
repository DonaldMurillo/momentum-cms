import { ChangeDetectionStrategy, Component, computed, input, viewChild } from '@angular/core';
import { TreeItemGroup, TreeItem } from '@angular/aria/tree';

@Component({
	selector: 'hdl-tree-item-group',
	exportAs: 'hdlTreeItemGroup',
	imports: [TreeItemGroup],
	host: {
		'[attr.data-slot]': '"tree-item-group"',
		'[attr.data-state]': 'isExpanded() ? "open" : "closed"',
		'[hidden]': '!isExpanded()',
	},
	template: `
		<ng-template ngTreeItemGroup [ownedBy]="ownedBy()">
			<ng-content />
		</ng-template>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTreeItemGroup {
	readonly ownedBy = input.required<TreeItem<string>>();
	private readonly treeItemGroup = viewChild(TreeItemGroup);

	get group(): TreeItemGroup<string> {
		const group = this.treeItemGroup();

		if (!group) {
			throw new Error('HdlTreeItemGroup is not ready yet.');
		}

		return group;
	}

	ready(): boolean {
		return !!this.treeItemGroup();
	}

	readonly isExpanded = computed(() => {
		const owner = this.ownedBy();
		return owner?.expanded() ?? false;
	});
}

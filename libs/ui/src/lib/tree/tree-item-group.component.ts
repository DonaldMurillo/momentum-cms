import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TreeItemGroup as AriaTreeItemGroup, TreeItem as AriaTreeItem } from '@angular/aria/tree';

/**
 * Groups child tree items under a parent item.
 *
 * @example
 * ```html
 * <mcms-tree-item #parentItem [parent]="tree" value="folder" label="Folder" [hasChildren]="true">
 *   Folder
 *   <mcms-tree-item-group [ownedBy]="parentItem">
 *     <mcms-tree-item [parent]="childGroup" value="file" label="File">File</mcms-tree-item>
 *   </mcms-tree-item-group>
 * </mcms-tree-item>
 * ```
 */
@Component({
	selector: 'mcms-tree-item-group',
	exportAs: 'mcmsTreeItemGroup',
	hostDirectives: [
		{
			directive: AriaTreeItemGroup,
			inputs: ['ownedBy'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'group',
		'[hidden]': '!isExpanded()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeItemGroupComponent {
	readonly group = inject(AriaTreeItemGroup);

	/** The parent tree item that owns this group */
	readonly ownedBy = input.required<AriaTreeItem<string>>();

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly isExpanded = computed(() => {
		const owner = this.ownedBy();
		return owner?.expanded() ?? false;
	});

	protected readonly hostClasses = computed(() => {
		const base = 'block pl-4';
		return `${base} ${this.class()}`.trim();
	});
}

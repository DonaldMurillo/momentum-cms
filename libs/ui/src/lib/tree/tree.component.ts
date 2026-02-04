import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { Tree as AriaTree } from '@angular/aria/tree';

/**
 * Tree component for displaying hierarchical data.
 *
 * Uses @angular/aria/tree for keyboard navigation (Arrow keys, Home/End, Enter/Space).
 *
 * @example
 * ```html
 * <mcms-tree [(value)]="selectedItems" [multi]="true">
 *   <mcms-tree-item [parent]="tree" value="folder1" label="Documents">
 *     <mcms-tree-item-group [ownedBy]="documentsItem">
 *       <mcms-tree-item [parent]="documentsGroup" value="file1" label="File 1" />
 *     </mcms-tree-item-group>
 *   </mcms-tree-item>
 * </mcms-tree>
 * ```
 */
@Component({
	selector: 'mcms-tree',
	exportAs: 'mcmsTree',
	hostDirectives: [
		{
			directive: AriaTree,
			inputs: ['multi', 'selectionMode', 'disabled', 'wrap', 'orientation', 'values'],
			outputs: ['valuesChange'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'tree',
		'[attr.aria-multiselectable]': 'multi()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tree {
	readonly ariaTree = inject(AriaTree);

	/** Whether multiple items can be selected */
	readonly multi = input(false);

	/** Selection mode: 'follow' (select on focus) or 'explicit' (require Enter/Space) */
	readonly selectionMode = input<'follow' | 'explicit'>('explicit');

	/** Whether the tree is disabled */
	readonly disabled = input(false);

	/** Whether navigation wraps around */
	readonly wrap = input(true);

	/** Selected item values */
	readonly values = model<string[]>([]);

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'block text-sm';
		return `${base} ${this.class()}`.trim();
	});
}

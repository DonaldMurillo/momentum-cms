import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { TreeItem as AriaTreeItem, Tree as AriaTree, TreeItemGroup } from '@angular/aria/tree';

/**
 * A single item/node in the tree.
 *
 * @example
 * ```html
 * <mcms-tree-item
 *   #documentsItem="mcmsTreeItem"
 *   [parent]="tree"
 *   value="documents"
 *   label="Documents"
 * >
 *   Documents
 *   <mcms-tree-item-group [ownedBy]="documentsItem">
 *     ...children
 *   </mcms-tree-item-group>
 * </mcms-tree-item>
 * ```
 */
@Component({
	selector: 'mcms-tree-item',
	exportAs: 'mcmsTreeItem',
	hostDirectives: [
		{
			directive: AriaTreeItem,
			inputs: ['value', 'parent', 'disabled', 'expanded', 'label', 'selectable'],
			outputs: ['expandedChange'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'treeitem',
		'[attr.aria-selected]': 'treeItem.selected()',
		'[attr.aria-expanded]': 'hasChildren() ? treeItem.expanded() : null',
		'[attr.aria-level]': 'treeItem.level()',
		'[attr.tabindex]': 'treeItem.active() ? 0 : -1',
	},
	template: `
		<!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
		<div [class]="contentClasses()" (click)="onClick($event)">
			@if (hasChildren()) {
				<button
					type="button"
					class="mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
					[class.rotate-90]="treeItem.expanded()"
					(click)="toggleExpanded($event)"
					tabindex="-1"
					aria-hidden="true"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-4 w-4"
					>
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</button>
			} @else {
				<span class="mr-1 h-4 w-4 shrink-0"></span>
			}
			<ng-content />
		</div>
		<ng-content select="mcms-tree-item-group, [mcmsTreeItemGroup]" />
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeItem {
	readonly treeItem = inject(AriaTreeItem);

	/** The value identifier for this item */
	readonly value = input.required<string>();

	/** Parent tree or tree item group */
	readonly parent = input.required<AriaTree<string> | TreeItemGroup<string>>();

	/** Text label for accessibility and typeahead */
	readonly label = input<string>();

	/** Whether the item is disabled */
	readonly disabled = input(false);

	/** Whether the item is expanded */
	readonly expanded = model(false);

	/** Whether the item is selectable */
	readonly selectable = input(true);

	/** Whether this item has children (should have a tree-item-group) */
	readonly hasChildren = input(false);

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'block';
		const disabledClasses = this.disabled() ? 'opacity-50 pointer-events-none' : '';
		return `${base} ${disabledClasses} ${this.class()}`.trim();
	});

	protected readonly contentClasses = computed(() => {
		const base = 'flex items-center py-1 px-2 rounded-sm cursor-default select-none outline-none';
		const interactiveClasses =
			'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';
		const activeClasses = this.treeItem.active() ? 'bg-accent text-accent-foreground' : '';
		const selectedClasses = this.treeItem.selected() ? 'font-medium' : '';
		return `${base} ${interactiveClasses} ${activeClasses} ${selectedClasses}`.trim();
	});

	onClick(event: Event): void {
		event.stopPropagation();
	}

	toggleExpanded(event: Event): void {
		event.stopPropagation();
		this.expanded.update((v) => !v);
	}
}

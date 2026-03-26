import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroFolder,
	heroFolderOpen,
	heroChevronRight,
	heroChevronDown,
	heroPlus,
} from '@ng-icons/heroicons/outline';

export interface FolderNode {
	id: string;
	name: string;
	parent: string | null;
}

export interface FolderTreeNode extends FolderNode {
	children: FolderTreeNode[];
	path: string;
}

/** Flattened tree node for rendering. */
interface FlatNode {
	id: string;
	name: string;
	path: string;
	depth: number;
	hasChildren: boolean;
}

/**
 * Build a tree from a flat list of folders.
 */
export function buildFolderTree(folders: FolderNode[]): FolderTreeNode[] {
	const map = new Map<string, FolderTreeNode>();

	for (const f of folders) {
		map.set(f.id, { ...f, children: [], path: '' });
	}

	const roots: FolderTreeNode[] = [];

	for (const node of map.values()) {
		if (node.parent && map.has(node.parent)) {
			map.get(node.parent)?.children.push(node);
		} else {
			roots.push(node);
		}
	}

	function computePaths(nodes: FolderTreeNode[], prefix: string): void {
		for (const node of nodes) {
			node.path = prefix + '/' + node.name;
			computePaths(node.children, node.path);
		}
	}
	computePaths(roots, '');

	return roots;
}

/**
 * Get all descendant IDs of a folder (for cycle prevention in parent dropdown).
 */
export function getDescendantIds(tree: FolderTreeNode[], folderId: string): Set<string> {
	const ids = new Set<string>();

	function collect(nodes: FolderTreeNode[]): void {
		for (const node of nodes) {
			ids.add(node.id);
			collect(node.children);
		}
	}

	function findAndCollect(nodes: FolderTreeNode[]): void {
		for (const node of nodes) {
			if (node.id === folderId) {
				collect(node.children);
				return;
			}
			findAndCollect(node.children);
		}
	}

	findAndCollect(tree);
	return ids;
}

/** Flatten tree into a list respecting expanded state. */
function flattenTree(nodes: FolderTreeNode[], expandedIds: Set<string>, depth: number): FlatNode[] {
	const result: FlatNode[] = [];
	for (const node of nodes) {
		result.push({
			id: node.id,
			name: node.name,
			path: node.path,
			depth,
			hasChildren: node.children.length > 0,
		});
		if (node.children.length > 0 && expandedIds.has(node.id)) {
			result.push(...flattenTree(node.children, expandedIds, depth + 1));
		}
	}
	return result;
}

@Component({
	selector: 'mcms-media-folder-tree',
	imports: [NgIcon],
	providers: [
		provideIcons({ heroFolder, heroFolderOpen, heroChevronRight, heroChevronDown, heroPlus }),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="space-y-0.5">
			<div class="space-y-0.5" role="tree" aria-label="Media folders">
				<!-- All Media root -->
				<button
					type="button"
					role="treeitem"
					class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[hsl(var(--mcms-accent))]"
					[class.bg-[hsl(var(--mcms-accent))]]="!selectedFolderId()"
					[class.font-medium]="!selectedFolderId()"
					[attr.aria-level]="1"
					[attr.aria-selected]="!selectedFolderId()"
					(click)="selectFolder(null)"
					data-slot="all-media"
				>
					<ng-icon name="heroFolder" class="h-4 w-4 shrink-0" aria-hidden="true" />
					All Media
				</button>

				<!-- Flattened folder tree -->
				@for (node of flatNodes(); track node.id) {
					<div role="presentation" [style.padding-left.px]="node.depth * 16">
						<button
							type="button"
							role="treeitem"
							class="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[hsl(var(--mcms-accent))]"
							[class.bg-[hsl(var(--mcms-accent))]]="selectedFolderId() === node.id"
							[class.font-medium]="selectedFolderId() === node.id"
							[attr.aria-expanded]="node.hasChildren ? expandedIds().has(node.id) : null"
							[attr.aria-level]="node.depth + 1"
							[attr.aria-selected]="selectedFolderId() === node.id"
							[attr.title]="node.path"
							[attr.data-folder-id]="node.id"
							(click)="onNodeSelected(node)"
						>
							<span class="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
								@if (node.hasChildren) {
									<ng-icon
										[name]="expandedIds().has(node.id) ? 'heroChevronDown' : 'heroChevronRight'"
										class="h-3 w-3"
									/>
								}
							</span>
							<ng-icon
								[name]="expandedIds().has(node.id) ? 'heroFolderOpen' : 'heroFolder'"
								class="h-4 w-4 shrink-0"
								aria-hidden="true"
							/>
							<span class="truncate">{{ node.name }}</span>
						</button>
					</div>
				}
			</div>

			@if (showCreateButton()) {
				<button
					type="button"
					class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[hsl(var(--mcms-muted-foreground))] transition-colors hover:bg-[hsl(var(--mcms-accent))] hover:text-[hsl(var(--mcms-foreground))]"
					(click)="createFolderClicked.emit()"
					data-slot="create-folder"
				>
					<ng-icon name="heroPlus" class="h-4 w-4 shrink-0" aria-hidden="true" />
					New Folder
				</button>
			}
		</div>
	`,
})
export class MediaFolderTreeComponent {
	readonly folders = input<FolderNode[]>([]);
	readonly selectedFolderId = input<string | null>(null);
	readonly showCreateButton = input(true);

	readonly folderSelected = output<string | null>();
	readonly createFolderClicked = output<void>();

	readonly expandedIds = signal<Set<string>>(new Set());

	readonly tree = computed(() => buildFolderTree(this.folders()));

	readonly flatNodes = computed(() => flattenTree(this.tree(), this.expandedIds(), 0));

	selectFolder(id: string | null): void {
		this.folderSelected.emit(id);
	}

	onNodeSelected(node: FlatNode): void {
		this.selectFolder(node.id);
		if (node.hasChildren) {
			this.toggleExpand(node.id);
		}
	}

	toggleExpand(id: string): void {
		const expanded = new Set(this.expandedIds());
		if (expanded.has(id)) {
			expanded.delete(id);
		} else {
			expanded.add(id);
		}
		this.expandedIds.set(expanded);
	}
}

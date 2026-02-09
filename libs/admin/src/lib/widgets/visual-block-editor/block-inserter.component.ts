/**
 * Block Inserter Component
 *
 * A "+" button that appears between blocks. When clicked, opens a command palette
 * for selecting which block type to insert at that position.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus } from '@ng-icons/heroicons/outline';
import type { BlockConfig } from '@momentum-cms/core';
import {
	PopoverTrigger,
	PopoverContent,
	Command,
	CommandInput,
	CommandList,
	CommandGroup,
	CommandItem,
	CommandEmpty,
} from '@momentum-cms/ui';

@Component({
	selector: 'mcms-block-inserter',
	imports: [
		NgIcon,
		PopoverTrigger,
		PopoverContent,
		Command,
		CommandInput,
		CommandList,
		CommandGroup,
		CommandItem,
		CommandEmpty,
	],
	providers: [provideIcons({ heroPlus })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'group relative flex items-center justify-center py-1',
		'[attr.data-testid]': '"block-inserter"',
		'[attr.data-insert-index]': 'insertIndex()',
	},
	template: `
		<!-- Horizontal line -->
		<div
			class="absolute inset-x-0 top-1/2 h-px bg-border opacity-0 transition-opacity group-hover:opacity-100"
			aria-hidden="true"
		></div>

		<!-- "+" button -->
		<button
			class="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			[mcmsPopoverTrigger]="blockPicker"
			popoverSide="bottom"
			popoverAlign="center"
			#popover="mcmsPopoverTrigger"
			[popoverDisabled]="disabled()"
			(opened)="onPopoverOpened()"
			(closed)="onPopoverClosed()"
			[attr.aria-label]="'Add block at position ' + insertIndex()"
		>
			<ng-icon name="heroPlus" size="14" aria-hidden="true" />
		</button>

		<!-- Block type picker popover -->
		<ng-template #blockPicker>
			<mcms-popover-content>
				<mcms-command class="w-64">
					<mcms-command-input
						placeholder="Search blocks..."
						[autofocus]="true"
						[(value)]="searchQuery"
					/>
					<mcms-command-list maxHeight="200px">
						<mcms-command-empty>No blocks found.</mcms-command-empty>
						<mcms-command-group label="Blocks">
							@for (blockDef of filteredBlocks(); track blockDef.slug) {
								<mcms-command-item
									[value]="blockDef.slug"
									(itemSelect)="selectBlockType(blockDef.slug)"
								>
									{{ blockDef.labels?.singular || blockDef.slug }}
								</mcms-command-item>
							}
						</mcms-command-group>
					</mcms-command-list>
				</mcms-command>
			</mcms-popover-content>
		</ng-template>
	`,
})
export class BlockInserterComponent {
	/** Position where the new block will be inserted */
	readonly insertIndex = input.required<number>();

	/** Available block type definitions */
	readonly blockDefinitions = input.required<BlockConfig[]>();

	/** Whether the inserter is disabled */
	readonly disabled = input(false);

	/** Emitted when a block type is selected */
	readonly blockTypeSelected = output<{ blockType: string; atIndex: number }>();

	readonly popover = viewChild<PopoverTrigger>('popover');

	readonly searchQuery = signal('');

	readonly filteredBlocks = computed((): BlockConfig[] => {
		const query = this.searchQuery().toLowerCase();
		if (!query) return this.blockDefinitions();
		return this.blockDefinitions().filter((b) => {
			const label = (b.labels?.singular || b.slug).toLowerCase();
			return label.includes(query);
		});
	});

	selectBlockType(slug: string): void {
		this.blockTypeSelected.emit({ blockType: slug, atIndex: this.insertIndex() });
		this.popover()?.close();
		this.searchQuery.set('');
	}

	onPopoverOpened(): void {
		this.searchQuery.set('');
	}

	onPopoverClosed(): void {
		this.searchQuery.set('');
	}
}

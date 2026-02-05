import { ChangeDetectionStrategy, Component, computed, forwardRef, input, output } from '@angular/core';
import {
	CdkDropList,
	CdkDrag,
	CdkDragHandle,
	type CdkDragDrop,
	moveItemInArray,
} from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus, heroTrash, heroBars2 } from '@ng-icons/heroicons/outline';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Badge } from '@momentum-cms/ui';
import type { Field, BlockConfig } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';
import { isRecord, getFieldDefaultValue, setValueAtPath } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/** Shape of a block item in the stored data */
interface BlockItem {
	blockType: string;
	[key: string]: unknown;
}

/**
 * Blocks field renderer.
 *
 * Renders a list of typed blocks. Each block has a `blockType` discriminator
 * and type-specific fields. Users can add, remove, and reorder blocks.
 * A dropdown allows selecting which block type to add.
 */
@Component({
	selector: 'mcms-blocks-field-renderer',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		CardFooter,
		Button,
		Badge,
		NgIcon,
		CdkDropList,
		CdkDrag,
		CdkDragHandle,
		forwardRef(() => FieldRenderer),
	],
	providers: [provideIcons({ heroPlus, heroTrash, heroBars2 })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-card>
			<mcms-card-header>
				<div class="flex items-center justify-between">
					<div>
						<mcms-card-title>{{ label() }}</mcms-card-title>
						@if (description()) {
							<p class="text-sm text-muted-foreground mt-1">{{ description() }}</p>
						}
					</div>
					<span class="text-sm text-muted-foreground">
						{{ blocks().length }}{{ maxRows() ? ' / ' + maxRows() : '' }} blocks
					</span>
				</div>
			</mcms-card-header>
			<mcms-card-content>
				@if (blocks().length === 0) {
					<p class="text-sm text-muted-foreground py-4 text-center">
						No blocks yet. Add a block to get started.
					</p>
				} @else {
					<div cdkDropList (cdkDropListDropped)="onDrop($event)" class="space-y-3">
						@for (block of blocks(); track $index; let i = $index) {
							<div
								cdkDrag
								class="border rounded-lg bg-card"
								[cdkDragDisabled]="isDisabled()"
							>
								<div class="flex items-center gap-3 px-4 py-2 border-b bg-muted/50 rounded-t-lg">
									<div
										cdkDragHandle
										class="cursor-grab text-muted-foreground hover:text-foreground"
										[class.hidden]="isDisabled()"
										role="button"
										tabindex="0"
										[attr.aria-label]="'Reorder ' + getBlockLabel(block.blockType) + ' block'"
										aria-roledescription="sortable"
									>
										<ng-icon name="heroBars2" size="16" aria-hidden="true" />
									</div>
									<mcms-badge>{{ getBlockLabel(block.blockType) }}</mcms-badge>
									<div class="flex-1"></div>
									@if (canRemoveBlock()) {
										<button
											mcms-button
											variant="ghost"
											size="icon"
											class="h-7 w-7 text-destructive hover:text-destructive"
											(click)="removeBlock(i)"
											[attr.aria-label]="'Remove ' + getBlockLabel(block.blockType) + ' block'"
										>
											<ng-icon name="heroTrash" size="14" aria-hidden="true" />
										</button>
									}
								</div>
								<div class="p-4 space-y-3">
									@for (subField of getBlockFields(block.blockType); track subField.name) {
										<mcms-field-renderer
											[field]="subField"
											[value]="getBlockFieldValue(block, subField.name)"
											[mode]="mode()"
											[path]="subField.name"
											[error]="undefined"
											(fieldChange)="onBlockFieldChange(i, $event)"
										/>
									}
								</div>
							</div>
						}
					</div>
				}
			</mcms-card-content>
			@if (canAddBlock()) {
				<mcms-card-footer>
					<div class="flex gap-2">
						@for (blockDef of blockDefinitions(); track blockDef.slug) {
							<button
								mcms-button
								variant="outline"
								(click)="addBlock(blockDef.slug)"
							>
								<ng-icon name="heroPlus" size="16" />
								{{ blockDef.labels?.singular || blockDef.slug }}
							</button>
						}
					</div>
				</mcms-card-footer>
			}
		</mcms-card>
	`,
})
export class BlocksFieldRenderer {
	/** Field definition (must be a BlocksField) */
	readonly field = input.required<Field>();

	/** Current value (should be an array of block objects) */
	readonly value = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (e.g., "content") */
	readonly path = input.required<string>();

	/** Field error */
	readonly error = input<string | undefined>(undefined);

	/** Field change event */
	readonly fieldChange = output<FieldChangeEvent>();

	/** Computed label */
	readonly label = computed(() => this.field().label || this.field().name);

	/** Computed description */
	readonly description = computed(() => this.field().description || '');

	/** Block type definitions from the field */
	readonly blockDefinitions = computed((): BlockConfig[] => {
		const f = this.field();
		if (f.type === 'blocks') {
			return f.blocks;
		}
		return [];
	});

	/** Min rows constraint */
	readonly minRows = computed((): number => {
		const f = this.field();
		return f.type === 'blocks' ? (f.minRows ?? 0) : 0;
	});

	/** Max rows constraint */
	readonly maxRows = computed((): number | undefined => {
		const f = this.field();
		return f.type === 'blocks' ? f.maxRows : undefined;
	});

	/** Current blocks as typed items */
	readonly blocks = computed((): BlockItem[] => {
		const val = this.value();
		if (Array.isArray(val)) {
			return val
				.filter((item): item is BlockItem => isRecord(item) && typeof item['blockType'] === 'string');
		}
		return [];
	});

	/** Whether the field is disabled (view mode) */
	readonly isDisabled = computed(() => this.mode() === 'view');

	/** Whether a new block can be added */
	readonly canAddBlock = computed((): boolean => {
		if (this.isDisabled()) return false;
		const max = this.maxRows();
		return max === undefined || this.blocks().length < max;
	});

	/** Whether blocks can be removed */
	readonly canRemoveBlock = computed((): boolean => {
		if (this.isDisabled()) return false;
		return this.blocks().length > this.minRows();
	});

	/** Block definition lookup cache */
	private blockDefMap = computed((): Map<string, BlockConfig> => {
		const map = new Map<string, BlockConfig>();
		for (const def of this.blockDefinitions()) {
			map.set(def.slug, def);
		}
		return map;
	});

	/** Get display label for a block type */
	getBlockLabel(blockType: string): string {
		const def = this.blockDefMap().get(blockType);
		return def?.labels?.singular || blockType;
	}

	/** Get fields for a block type */
	getBlockFields(blockType: string): Field[] {
		const def = this.blockDefMap().get(blockType);
		return def?.fields.filter((f) => !f.admin?.hidden) ?? [];
	}

	/** Get a field value from a block */
	getBlockFieldValue(block: BlockItem, fieldName: string): unknown {
		return block[fieldName] ?? null;
	}

	/** Handle field change within a block */
	onBlockFieldChange(blockIndex: number, event: FieldChangeEvent): void {
		const currentBlocks = this.blocks();
		const block = currentBlocks[blockIndex];
		if (!block) return;

		const updatedBlock = setValueAtPath(
			block,
			event.path,
			event.value,
		);
		const updatedBlocks = currentBlocks.map((b, i) =>
			i === blockIndex ? { ...updatedBlock, blockType: block.blockType } : b,
		);
		this.fieldChange.emit({ path: this.path(), value: updatedBlocks });
	}

	/** Handle drag-drop reorder */
	onDrop(event: CdkDragDrop<unknown>): void {
		const blocks = [...this.blocks()];
		moveItemInArray(blocks, event.previousIndex, event.currentIndex);
		this.fieldChange.emit({ path: this.path(), value: blocks });
	}

	/** Add a new block of the given type */
	addBlock(blockType: string): void {
		const def = this.blockDefMap().get(blockType);
		if (!def) return;

		const newBlock: BlockItem = { blockType };
		for (const field of def.fields) {
			newBlock[field.name] = getFieldDefaultValue(field);
		}

		const blocks = [...this.blocks(), newBlock];
		this.fieldChange.emit({ path: this.path(), value: blocks });
	}

	/** Remove a block at the given index */
	removeBlock(index: number): void {
		const blocks = this.blocks().filter((_, i) => i !== index);
		this.fieldChange.emit({ path: this.path(), value: blocks });
	}
}

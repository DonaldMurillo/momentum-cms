import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
	CdkDropList,
	CdkDrag,
	CdkDragHandle,
	type CdkDragDrop,
	moveItemInArray,
} from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus, heroTrash, heroBars2 } from '@ng-icons/heroicons/outline';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button } from '@momentumcms/ui';
import { humanizeFieldName } from '@momentumcms/core';
import type { Field } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import {
	getFieldNodeState,
	getSubNode,
	isRecord,
	getFieldDefaultValue,
} from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Array field renderer.
 *
 * Renders an array of rows, each row displayed as a card with sub-fields.
 * Supports add/remove rows and drag-drop reordering via CDK DragDrop.
 * Respects minRows/maxRows constraints.
 *
 * Data container pattern: passes row sub-field FieldTree nodes via
 * getSubNode(getSubNode(formNode, rowIndex), subFieldName).
 * Array mutations use nodeState.value.set(newArray).
 */
@Component({
	selector: 'mcms-array-field-renderer',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		CardFooter,
		Button,
		NgIcon,
		CdkDropList,
		CdkDrag,
		CdkDragHandle,
		FieldRenderer,
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
						{{ rows().length }}{{ maxRows() ? ' / ' + maxRows() : '' }} rows
					</span>
				</div>
			</mcms-card-header>
			<mcms-card-content>
				@if (rows().length === 0) {
					<p class="text-sm text-muted-foreground py-4 text-center">
						No items yet. Click "Add Row" to get started.
					</p>
				} @else {
					<div
						cdkDropList
						(cdkDropListDropped)="onDrop($event)"
						class="space-y-3"
						role="list"
						aria-label="Array rows"
					>
						@for (row of rows(); track $index; let i = $index) {
							<div
								cdkDrag
								class="border rounded-lg p-4 bg-card flex gap-3 items-start"
								[cdkDragDisabled]="isDisabled()"
							>
								<div
									cdkDragHandle
									class="cursor-grab pt-1 text-muted-foreground hover:text-foreground"
									[class.hidden]="isDisabled()"
									role="button"
									tabindex="0"
									[attr.aria-label]="'Reorder row ' + (i + 1)"
									aria-roledescription="sortable"
								>
									<ng-icon name="heroBars2" size="16" aria-hidden="true" />
								</div>
								<div class="flex-1 space-y-3">
									@for (subField of subFields(); track subField.name) {
										<mcms-field-renderer
											[field]="subField"
											[formNode]="getRowSubNode(i, subField.name)"
											[formTree]="formTree()"
											[formModel]="formModel()"
											[mode]="mode()"
											[path]="getRowSubFieldPath(i, subField.name)"
										/>
									}
								</div>
								@if (canRemoveRow()) {
									<button
										mcms-button
										variant="ghost"
										size="icon"
										class="shrink-0 text-destructive hover:text-destructive"
										(click)="removeRow(i)"
										[attr.aria-label]="'Remove row ' + (i + 1)"
									>
										<ng-icon name="heroTrash" size="16" aria-hidden="true" />
									</button>
								}
							</div>
						}
					</div>
				}
			</mcms-card-content>
			@if (canAddRow()) {
				<mcms-card-footer>
					<button mcms-button variant="outline" (click)="addRow()">
						<ng-icon name="heroPlus" size="16" aria-hidden="true" />
						Add Row
					</button>
				</mcms-card-footer>
			}
		</mcms-card>
	`,
})
export class ArrayFieldRenderer {
	/** Field definition (must be an ArrayField) */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this array */
	readonly formNode = input<unknown>(null);

	/** Root signal forms FieldTree (for layout fields that look up child nodes) */
	readonly formTree = input<unknown>(null);

	/** Form model data (for condition evaluation and relationship filterOptions) */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (e.g., "features") */
	readonly path = input.required<string>();

	/** Bridge: extract FieldState from formNode */
	private readonly nodeState = computed(() => getFieldNodeState(this.formNode()));

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

	/** Computed description */
	readonly description = computed(() => this.field().description || '');

	/** Sub-fields from the array definition */
	readonly subFields = computed((): Field[] => {
		const f = this.field();
		if (f.type === 'array') {
			return f.fields.filter((sf) => !sf.admin?.hidden);
		}
		return [];
	});

	/** Min rows constraint */
	readonly minRows = computed((): number => {
		const f = this.field();
		return f.type === 'array' ? (f.minRows ?? 0) : 0;
	});

	/** Max rows constraint */
	readonly maxRows = computed((): number | undefined => {
		const f = this.field();
		return f.type === 'array' ? f.maxRows : undefined;
	});

	/** Current rows as array of objects (read from FieldState) */
	readonly rows = computed((): Record<string, unknown>[] => {
		const state = this.nodeState();
		if (!state) return [];
		const val = state.value();
		if (Array.isArray(val)) {
			return val.map((item) => (isRecord(item) ? item : {}));
		}
		return [];
	});

	/** Whether the field is disabled (view mode) */
	readonly isDisabled = computed(() => this.mode() === 'view');

	/** Whether a new row can be added */
	readonly canAddRow = computed((): boolean => {
		if (this.isDisabled()) return false;
		const max = this.maxRows();
		return max === undefined || this.rows().length < max;
	});

	/** Whether rows can be removed */
	readonly canRemoveRow = computed((): boolean => {
		if (this.isDisabled()) return false;
		return this.rows().length > this.minRows();
	});

	/** Get a FieldTree sub-node for a row's sub-field */
	getRowSubNode(rowIndex: number, subFieldName: string): unknown {
		const rowNode = getSubNode(this.formNode(), rowIndex);
		return getSubNode(rowNode, subFieldName);
	}

	/** Get the full path for a row's sub-field */
	getRowSubFieldPath(rowIndex: number, subFieldName: string): string {
		return `${this.path()}.${rowIndex}.${subFieldName}`;
	}

	/** Handle drag-drop reorder */
	onDrop(event: CdkDragDrop<unknown>): void {
		const state = this.nodeState();
		if (!state) return;
		const rows = [...this.rows()];
		moveItemInArray(rows, event.previousIndex, event.currentIndex);
		state.value.set(rows);
	}

	/** Add a new empty row */
	addRow(): void {
		const state = this.nodeState();
		if (!state) return;
		const rows = [...this.rows()];
		const newRow: Record<string, unknown> = {};
		for (const field of this.subFields()) {
			newRow[field.name] = getFieldDefaultValue(field);
		}
		rows.push(newRow);
		state.value.set(rows);
	}

	/** Remove a row at the given index */
	removeRow(index: number): void {
		const state = this.nodeState();
		if (!state) return;
		const rows = this.rows().filter((_, i) => i !== index);
		state.value.set(rows);
	}
}

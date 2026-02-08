import { NgTemplateOutlet } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	model,
	output,
} from '@angular/core';
import type {
	DataTableColumn,
	DataTableRowAction,
	DataTableRowActionEvent,
	DataTableSort,
} from './data-table.types';
import { Table } from '../table/table.component';
import { TableHeader } from '../table/table-header.component';
import { TableBody } from '../table/table-body.component';
import { TableRow } from '../table/table-row.component';
import { TableHead } from '../table/table-head.component';
import { TableCell } from '../table/table-cell.component';
import { Checkbox } from '../checkbox/checkbox.component';
import { Skeleton } from '../skeleton/skeleton.component';
import { EmptyState } from '../empty-state/empty-state.component';
import { Pagination } from '../pagination/pagination.component';
import { SearchInput } from '../search-input/search-input.component';
import { Button } from '../button/button.component';
import { DropdownTrigger } from '../dropdown-menu/dropdown-trigger.directive';
import { DropdownMenu } from '../dropdown-menu/dropdown-menu.component';
import { DropdownMenuItem } from '../dropdown-menu/dropdown-menu-item.component';

/**
 * A feature-rich data table component with search, sorting, pagination, and selection.
 *
 * @example
 * ```html
 * <mcms-data-table
 *   [data]="users"
 *   [columns]="columns"
 *   [searchable]="true"
 *   [selectable]="true"
 *   [paginated]="true"
 *   (rowClick)="onRowClick($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-data-table',
	imports: [
		NgTemplateOutlet,
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell,
		Checkbox,
		Skeleton,
		EmptyState,
		Pagination,
		SearchInput,
		Button,
		DropdownTrigger,
		DropdownMenu,
		DropdownMenuItem,
	],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		<!-- Toolbar with search -->
		@if (searchable() || hasToolbarSlot) {
			<div class="flex items-center justify-between gap-4 mb-4">
				@if (searchable()) {
					<mcms-search-input
						[(value)]="searchQuery"
						[placeholder]="searchPlaceholder()"
						(searchChange)="onSearchChange($event)"
						class="w-full max-w-sm"
					/>
				}
				<ng-content select="[mcmsDataTableToolbar]" />
			</div>
		}

		<!-- Table container -->
		<div class="rounded-lg border border-border overflow-x-auto">
			@if (loading()) {
				<!-- Loading state -->
				<mcms-table class="min-w-max">
					<mcms-table-header>
						<mcms-table-row>
							@if (selectable()) {
								<mcms-table-head class="w-12">
									<mcms-skeleton class="h-4 w-4" />
								</mcms-table-head>
							}
							@for (col of columns(); track col.field) {
								<mcms-table-head [style.width]="col.width" [style.min-width]="col.minWidth || '100px'">
									<mcms-skeleton class="h-4 w-20" />
								</mcms-table-head>
							}
							@if (rowActions().length > 0) {
								<mcms-table-head class="w-12"></mcms-table-head>
							}
						</mcms-table-row>
					</mcms-table-header>
					<mcms-table-body>
						@for (i of skeletonRows; track i) {
							<mcms-table-row>
								@if (selectable()) {
									<mcms-table-cell>
										<mcms-skeleton class="h-4 w-4" />
									</mcms-table-cell>
								}
								@for (col of columns(); track col.field) {
									<mcms-table-cell>
										<mcms-skeleton class="h-4 w-full" />
									</mcms-table-cell>
								}
								@if (rowActions().length > 0) {
									<mcms-table-cell>
										<mcms-skeleton class="h-4 w-8" />
									</mcms-table-cell>
								}
							</mcms-table-row>
						}
					</mcms-table-body>
				</mcms-table>
			} @else if (displayData().length === 0) {
				<!-- Empty state -->
				<div class="p-8">
					<mcms-empty-state [title]="emptyTitle()" [description]="emptyDescription()" icon="inbox">
						<ng-content select="[mcmsDataTableEmpty]" />
					</mcms-empty-state>
				</div>
			} @else {
				<!-- Data table -->
				<mcms-table class="min-w-max">
					<mcms-table-header>
						<mcms-table-row>
							@if (selectable()) {
								<mcms-table-head class="w-12">
									<mcms-checkbox
										[value]="allSelected()"
										[indeterminate]="someSelected()"
										(valueChange)="toggleSelectAll()"
									/>
								</mcms-table-head>
							}
							@for (col of columns(); track col.field) {
								<mcms-table-head
									[style.width]="col.width"
									[style.min-width]="col.minWidth || '100px'"
									[style.text-align]="col.align || 'left'"
									[class.cursor-pointer]="col.sortable && sortable()"
									[class.select-none]="col.sortable && sortable()"
									[attr.aria-sort]="col.sortable && sortable() && sort()?.field === col.field ? (sort()?.direction === 'asc' ? 'ascending' : 'descending') : null"
									[attr.role]="col.sortable && sortable() ? 'button' : null"
									[attr.tabindex]="col.sortable && sortable() ? 0 : null"
									(click)="col.sortable && sortable() && toggleSort(col.field)"
									(keydown.enter)="col.sortable && sortable() && toggleSort(col.field)"
									(keydown.space)="col.sortable && sortable() && toggleSort(col.field); $event.preventDefault()"
								>
									<div class="flex items-center gap-2">
										<span>{{ col.header }}</span>
										@if (col.sortable && sortable() && sort()?.field === col.field) {
											<svg
												aria-hidden="true"
												xmlns="http://www.w3.org/2000/svg"
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												[class.rotate-180]="sort()?.direction === 'desc'"
												class="transition-transform"
											>
												<path d="m18 15-6-6-6 6" />
											</svg>
										}
									</div>
								</mcms-table-head>
							}
							@if (rowActions().length > 0) {
								<mcms-table-head class="w-12"></mcms-table-head>
							}
						</mcms-table-row>
					</mcms-table-header>
					<mcms-table-body>
						@for (item of displayData(); track trackByFn()(item); let idx = $index) {
							<mcms-table-row
								[class.bg-muted/50]="isSelected(item)"
								[class.cursor-pointer]="clickableRows()"
								(click)="onRowClicked(item)"
							>
								@if (selectable()) {
									<mcms-table-cell (click)="$event.stopPropagation()">
										<mcms-checkbox [value]="isSelected(item)" (valueChange)="toggleSelect(item)" />
									</mcms-table-cell>
								}
								@for (col of columns(); track col.field) {
									<mcms-table-cell [style.text-align]="col.align || 'left'">
										@if (col.template) {
											<ng-container
												*ngTemplateOutlet="
													col.template;
													context: {
														$implicit: getCellValue(item, col.field),
														item: item,
														column: col,
														index: idx,
													}
												"
											/>
										} @else {
											{{ renderCell(item, col) }}
										}
									</mcms-table-cell>
								}
								@if (rowActions().length > 0) {
									<mcms-table-cell (click)="$event.stopPropagation()">
										<button
											mcms-button
											variant="ghost"
											size="icon"
											aria-label="Row actions"
											[mcmsDropdownTrigger]="rowActionsMenu"
										>
											<svg
												aria-hidden="true"
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<circle cx="12" cy="12" r="1" />
												<circle cx="12" cy="5" r="1" />
												<circle cx="12" cy="19" r="1" />
											</svg>
										</button>
										<ng-template #rowActionsMenu>
											<mcms-dropdown-menu>
												@for (action of getVisibleActions(item); track action.id) {
													<button
														mcms-dropdown-item
														[value]="action.id"
														[disabled]="isActionDisabled(item, action)"
														(click)="onActionClick(item, action)"
													>
														{{ action.label }}
													</button>
												}
											</mcms-dropdown-menu>
										</ng-template>
									</mcms-table-cell>
								}
							</mcms-table-row>
						}
					</mcms-table-body>
				</mcms-table>
			}
		</div>

		<!-- Pagination -->
		@if (paginated() && !loading() && totalPages() > 1) {
			<div class="flex items-center justify-between mt-4">
				<span class="text-sm text-muted-foreground">
					Showing {{ paginationStart() }}-{{ paginationEnd() }} of {{ computedTotalItems() }}
				</span>
				<mcms-pagination
					[currentPage]="currentPage()"
					[totalPages]="totalPages()"
					(pageChange)="onPageChanged($event)"
				/>
			</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTable<T = unknown> {
	// Data inputs
	readonly data = input.required<T[]>();
	readonly columns = input.required<DataTableColumn<T>[]>();
	readonly loading = input(false);

	// Search
	readonly searchable = input(true);
	readonly searchPlaceholder = input('Search...');
	readonly searchFields = input<(keyof T | string)[]>([]);

	// Sort
	readonly sortable = input(true);
	readonly sort = model<DataTableSort<T> | undefined>(undefined);

	// Selection
	readonly selectable = input(false);
	readonly selectedItems = model<T[]>([]);

	// Pagination
	readonly paginated = input(true);
	readonly pageSize = input(10);
	readonly pageSizeOptions = input([10, 25, 50, 100]);
	readonly currentPage = model(1);
	readonly totalItems = input<number | undefined>(undefined);

	// Empty state
	readonly emptyTitle = input('No data');
	readonly emptyDescription = input('');

	// Row interactions
	readonly clickableRows = input(false);
	readonly rowActions = input<DataTableRowAction<T>[]>([]);
	readonly trackByFn = input<(item: T) => unknown>((item) => item);

	// Additional CSS classes
	readonly class = input('');

	// Outputs
	readonly searchChange = output<string>();
	readonly sortChange = output<DataTableSort<T> | undefined>();
	readonly selectionChange = output<T[]>();
	readonly pageChange = output<number>();
	readonly pageSizeChange = output<number>();
	readonly rowClick = output<T>();
	readonly rowAction = output<DataTableRowActionEvent<T>>();

	/** Search query (two-way bindable for parent control) */
	readonly searchQuery = model('');
	readonly hasToolbarSlot = false; // Will be set via content projection

	// Skeleton rows for loading state
	readonly skeletonRows = [1, 2, 3, 4, 5];

	// Computed values
	readonly hostClasses = computed(() => {
		return `block ${this.class()}`.trim();
	});

	readonly filteredData = computed(() => {
		const data = this.data();
		const query = this.searchQuery().toLowerCase().trim();

		if (!query || !this.searchable()) {
			return data;
		}

		const fields =
			this.searchFields().length > 0 ? this.searchFields() : this.columns().map((c) => c.field);

		return data.filter((item) =>
			fields.some((field) => {
				const value = this.getCellValue(item, field);
				return String(value).toLowerCase().includes(query);
			}),
		);
	});

	readonly sortedData = computed(() => {
		const data = this.filteredData();
		const sortState = this.sort();

		if (!sortState || !this.sortable()) {
			return data;
		}

		return [...data].sort((a, b) => {
			const aVal = this.getCellValue(a, sortState.field);
			const bVal = this.getCellValue(b, sortState.field);

			let comparison = 0;
			if (aVal === null || aVal === undefined) comparison = 1;
			else if (bVal === null || bVal === undefined) comparison = -1;
			else if (typeof aVal === 'string' && typeof bVal === 'string') {
				comparison = aVal.localeCompare(bVal);
			} else if (typeof aVal === 'number' && typeof bVal === 'number') {
				comparison = aVal - bVal;
			} else {
				comparison = String(aVal).localeCompare(String(bVal));
			}

			return sortState.direction === 'desc' ? -comparison : comparison;
		});
	});

	readonly displayData = computed(() => {
		const data = this.sortedData();

		if (!this.paginated()) {
			return data;
		}

		const page = this.currentPage();
		const size = this.pageSize();
		const start = (page - 1) * size;
		return data.slice(start, start + size);
	});

	readonly computedTotalItems = computed(() => {
		return this.totalItems() ?? this.filteredData().length;
	});

	readonly totalPages = computed(() => {
		return Math.ceil(this.computedTotalItems() / this.pageSize());
	});

	readonly paginationStart = computed(() => {
		return (this.currentPage() - 1) * this.pageSize() + 1;
	});

	readonly paginationEnd = computed(() => {
		return Math.min(this.currentPage() * this.pageSize(), this.computedTotalItems());
	});

	readonly allSelected = computed(() => {
		const data = this.displayData();
		const selected = this.selectedItems();
		return data.length > 0 && data.every((item) => selected.includes(item));
	});

	readonly someSelected = computed(() => {
		const data = this.displayData();
		const selected = this.selectedItems();
		const selectedCount = data.filter((item) => selected.includes(item)).length;
		return selectedCount > 0 && selectedCount < data.length;
	});

	constructor() {
		// Reset to page 1 when search changes
		effect(() => {
			this.searchQuery();
			this.currentPage.set(1);
		});
	}

	getCellValue(item: T, field: keyof T | string): unknown {
		if (typeof field === 'string' && field.includes('.')) {
			return field.split('.').reduce<unknown>((obj, key) => {
				return this.getObjectProperty(obj, key);
			}, item);
		}
		return this.getObjectProperty(item, String(field));
	}

	/**
	 * Safely get a property from an object.
	 * Uses type guard pattern to satisfy strict type checking.
	 */
	private getObjectProperty(obj: unknown, key: string): unknown {
		if (this.isRecord(obj) && key in obj) {
			return obj[key];
		}
		return undefined;
	}

	/**
	 * Type guard for Record<string, unknown>.
	 */
	private isRecord(value: unknown): value is Record<string, unknown> {
		return value !== null && typeof value === 'object';
	}

	renderCell(item: T, col: DataTableColumn<T>): string {
		const value = this.getCellValue(item, col.field);
		if (col.render) {
			return col.render(value, item);
		}
		if (value === null || value === undefined) {
			return '';
		}
		return String(value);
	}

	onSearchChange(value: string): void {
		// SearchInput component handles debouncing, so we just emit
		this.searchChange.emit(value);
	}

	toggleSort(field: keyof T | string): void {
		const current = this.sort();
		let newSort: DataTableSort<T> | undefined;

		if (current?.field === field) {
			if (current.direction === 'asc') {
				newSort = { field, direction: 'desc' };
			} else {
				// Third click clears the sort
				newSort = undefined;
			}
		} else {
			newSort = { field, direction: 'asc' };
		}

		this.sort.set(newSort);
		this.sortChange.emit(newSort);
	}

	toggleSelect(item: T): void {
		const selected = [...this.selectedItems()];
		const index = selected.indexOf(item);

		if (index >= 0) {
			selected.splice(index, 1);
		} else {
			selected.push(item);
		}

		this.selectedItems.set(selected);
		this.selectionChange.emit(selected);
	}

	toggleSelectAll(): void {
		const data = this.displayData();
		const allSelected = this.allSelected();

		if (allSelected) {
			// Deselect all displayed items
			const newSelected = this.selectedItems().filter((item) => !data.includes(item));
			this.selectedItems.set(newSelected);
			this.selectionChange.emit(newSelected);
		} else {
			// Select all displayed items
			const newSelected = [...new Set([...this.selectedItems(), ...data])];
			this.selectedItems.set(newSelected);
			this.selectionChange.emit(newSelected);
		}
	}

	isSelected(item: T): boolean {
		return this.selectedItems().includes(item);
	}

	onPageChanged(page: number): void {
		this.currentPage.set(page);
		this.pageChange.emit(page);
	}

	onRowClicked(item: T): void {
		if (this.clickableRows()) {
			this.rowClick.emit(item);
		}
	}

	getVisibleActions(item: T): DataTableRowAction<T>[] {
		return this.rowActions().filter((action) => !action.visible || action.visible(item));
	}

	isActionDisabled(item: T, action: DataTableRowAction<T>): boolean {
		return action.disabled ? action.disabled(item) : false;
	}

	onActionClick(item: T, action: DataTableRowAction<T>): void {
		if (action.handler) {
			action.handler(item);
		}
		this.rowAction.emit({ action, item });
	}
}

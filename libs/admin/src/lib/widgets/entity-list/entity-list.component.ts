import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	model,
	output,
	signal,
	type TemplateRef,
	viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { CollectionConfig, Field } from '@momentum-cms/core';
import { humanizeFieldName, getSoftDeleteField } from '@momentum-cms/core';
import {
	DataTable,
	Button,
	Badge,
	Breadcrumbs,
	BreadcrumbItem,
	BreadcrumbSeparator,
	DialogService,
	type DataTableSort,
	type DataTableRowAction,
	type DataTableRowActionEvent,
	type DataTableCellContext,
} from '@momentum-cms/ui';
import type { FieldDisplayFieldMeta } from '@momentum-cms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroEye } from '@ng-icons/heroicons/outline';
import { injectMomentumAPI, type FindResult } from '../../services/momentum-api.service';
import { CollectionAccessService } from '../../services/collection-access.service';
import { FeedbackService } from '../feedback/feedback.service';
import type { Entity, EntityAction } from '../widget.types';
import {
	type EntityListColumn,
	type EntityListActionEvent,
	type EntityListBulkActionEvent,
	FIELD_TYPE_TO_COLUMN_TYPE,
	mapEntityActionsToRowActions,
} from './entity-list.types';
import {
	DataPreviewDialog,
	type DataPreviewDialogData,
} from '../data-preview/data-preview-dialog.component';

/**
 * Entity List Widget
 *
 * Displays a collection's data in a data table with search, sorting,
 * pagination, and actions. Connects to Momentum API for data fetching.
 *
 * @example
 * ```html
 * <mcms-entity-list
 *   [collection]="postsCollection"
 *   basePath="/admin/collections"
 *   (entityClick)="onEntityClick($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-entity-list',
	imports: [DataTable, Button, Badge, Breadcrumbs, BreadcrumbItem, BreadcrumbSeparator, NgIcon],
	providers: [provideIcons({ heroEye })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (showHeader()) {
			@if (showBreadcrumbs()) {
				<mcms-breadcrumbs class="mb-6">
					<mcms-breadcrumb-item [href]="dashboardPath()">Dashboard</mcms-breadcrumb-item>
					<mcms-breadcrumb-separator />
					<mcms-breadcrumb-item [current]="true">{{ collectionLabel() }}</mcms-breadcrumb-item>
				</mcms-breadcrumbs>
			}

			<header class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">
						{{ viewingTrash() ? 'Trash' : collectionLabel() }}
					</h1>
					@if (totalItems() > 0) {
						<p class="mt-1 text-muted-foreground">
							{{ totalItems() }}
							{{ totalItems() === 1 ? collectionLabelSingular() : collectionLabel() }}
						</p>
					}
				</div>
				<div class="flex items-center gap-2">
					@if (hasSoftDelete()) {
						<button
							mcms-button
							[variant]="viewingTrash() ? 'outline' : 'ghost'"
							size="sm"
							(click)="toggleTrashView()"
						>
							{{ viewingTrash() ? 'View Active' : 'View Trash' }}
						</button>
					}
					@for (action of headerActions(); track action.id) {
						<button
							mcms-button
							variant="outline"
							[attr.data-testid]="'header-action-' + action.id"
							(click)="headerActionClick.emit(action)"
						>
							{{ action.label }}
						</button>
					}
					@if (canCreate() && !viewingTrash()) {
						<button mcms-button variant="primary" (click)="onCreateClick()">
							Create {{ collectionLabelSingular() }}
						</button>
					}
				</div>
			</header>
		}

		<mcms-data-table
			[data]="entities()"
			[columns]="tableColumns()"
			[loading]="loading()"
			[searchable]="searchable()"
			[searchPlaceholder]="searchPlaceholder()"
			[(searchQuery)]="searchQuery"
			[sortable]="sortable()"
			[(sort)]="sort"
			[selectable]="selectable()"
			[(selectedItems)]="selectedEntities"
			[paginated]="paginated()"
			[pageSize]="pageSize()"
			[(currentPage)]="currentPage"
			[totalItems]="totalItems()"
			[emptyTitle]="emptyTitle()"
			[emptyDescription]="emptyDescription()"
			[clickableRows]="true"
			[rowActions]="tableRowActions()"
			[trackByFn]="trackById"
			(rowClick)="onRowClick($event)"
			(rowAction)="onRowAction($event)"
			(searchChange)="onSearchChange($event)"
			(pageChange)="onPageChange($event)"
			(sortChange)="onSortChange($event)"
		>
			<!-- Bulk actions toolbar -->
			@if (selectedEntities().length > 0) {
				<div mcmsDataTableToolbar class="flex items-center gap-2">
					<mcms-badge variant="secondary"> {{ selectedEntities().length }} selected </mcms-badge>
					@for (action of bulkActions(); track action.id) {
						<button
							mcms-button
							[variant]="action.variant === 'destructive' ? 'destructive' : 'outline'"
							size="sm"
							(click)="onBulkAction(action)"
						>
							{{ action.label }}
						</button>
					}
				</div>
			}
		</mcms-data-table>

		<!-- Template for complex field cells (group, array, json) -->
		<ng-template #complexCell let-value let-column="column">
			<div class="flex items-center gap-1.5">
				<span class="text-muted-foreground">{{ getComplexSummary(value, column.type) }}</span>
				@if (value !== null && value !== undefined) {
					<button
						mcms-button
						variant="ghost"
						size="icon"
						class="h-6 w-6 shrink-0"
						(click)="$event.stopPropagation(); openDataPreview(value, column.field)"
						aria-label="View details"
					>
						<ng-icon name="heroEye" class="h-3 w-3" aria-hidden="true" />
					</button>
				}
			</div>
		</ng-template>
	`,
})
export class EntityListWidget<T extends Entity = Entity> {
	private readonly api = injectMomentumAPI();
	private readonly collectionAccess = inject(CollectionAccessService);
	private readonly feedback = inject(FeedbackService);
	private readonly dialog = inject(DialogService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	/** Template ref for complex cell rendering (group, array, json). */
	private readonly complexCellTemplate =
		viewChild<TemplateRef<DataTableCellContext<T>>>('complexCell');

	/** The collection configuration */
	readonly collection = input.required<CollectionConfig>();

	/** Base path for entity routes */
	readonly basePath = input('/admin/collections');

	/** Whether to show the header with title and create button */
	readonly showHeader = input(true);

	/** Whether to show breadcrumbs */
	readonly showBreadcrumbs = input(true);

	/** Custom columns (auto-derived from collection if not provided) */
	readonly columns = input<EntityListColumn<T>[]>([]);

	/** Row actions for each entity */
	readonly rowActions = input<EntityAction[]>([]);

	/** Bulk actions for selected entities */
	readonly bulkActions = input<EntityAction[]>([]);

	/** Custom action buttons displayed in the collection list header */
	readonly headerActions = input<
		NonNullable<NonNullable<CollectionConfig['admin']>['headerActions']>
	>([]);

	/** Emitted when a header action button is clicked */
	readonly headerActionClick =
		output<NonNullable<NonNullable<CollectionConfig['admin']>['headerActions']>[number]>();

	/** Whether the table is searchable */
	readonly searchable = input(true);

	/** Search placeholder */
	readonly searchPlaceholder = input('Search...');

	/** Fields to search in (auto-derived if not provided) */
	readonly searchFields = input<string[]>([]);

	/** Whether the table is sortable */
	readonly sortable = input(true);

	/** Whether the table is selectable */
	readonly selectable = input(false);

	/** Whether the table is paginated */
	readonly paginated = input(true);

	/** Default page size */
	readonly pageSize = input(10);

	/** Empty state title */
	readonly emptyTitle = input('No items found');

	/** Empty state description */
	readonly emptyDescription = input('');

	/** Outputs */
	readonly entityClick = output<T>();
	readonly entityAction = output<EntityListActionEvent<T>>();
	readonly bulkAction = output<EntityListBulkActionEvent<T>>();
	readonly dataLoaded = output<FindResult<T>>();

	/** Internal state */
	readonly entities = signal<T[]>([]);
	readonly totalItems = signal(0);
	readonly loading = signal(true);
	readonly error = signal<string | null>(null);
	readonly currentPage = signal(1);
	readonly sort = signal<DataTableSort<T> | undefined>(undefined);
	readonly selectedEntities = signal<T[]>([]);
	readonly searchQuery = model('');
	readonly viewingTrash = signal(false);

	/** Whether the collection has soft delete enabled */
	readonly hasSoftDelete = computed(() => getSoftDeleteField(this.collection()) !== null);

	/** Computed collection label */
	readonly collectionLabel = computed(() => {
		const col = this.collection();
		return humanizeFieldName(col.labels?.plural || col.slug);
	});

	/** Computed collection label singular */
	readonly collectionLabelSingular = computed(() => {
		const col = this.collection();
		return humanizeFieldName(col.labels?.singular || col.slug);
	});

	/** Dashboard path (remove /collections from base path) */
	readonly dashboardPath = computed(() => {
		const base = this.basePath();
		return base.replace(/\/collections$/, '');
	});

	/** Auto-derive columns from collection fields if not provided */
	readonly tableColumns = computed(() => {
		// Read template signal at top level so the computed re-runs when viewChild resolves
		const complexTemplate = this.complexCellTemplate();

		const customColumns = this.columns();
		if (customColumns.length > 0) {
			return customColumns;
		}

		// Auto-derive from collection fields
		const col = this.collection();
		const columns: EntityListColumn<T>[] = [];

		// Add first text/title-like field as primary column
		for (const field of col.fields) {
			if (this.shouldShowFieldInList(field)) {
				columns.push(this.fieldToColumn(field, complexTemplate));
			}
			// Limit to 5 auto-derived columns
			if (columns.length >= 5) break;
		}

		// Add deletedAt column when viewing trash
		if (this.viewingTrash() && this.hasSoftDelete()) {
			const softDeleteField = getSoftDeleteField(col) ?? 'deletedAt';
			columns.push({
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
				field: softDeleteField as keyof T & string,
				header: 'Deleted',
				sortable: true,
				type: 'datetime',
				width: '170px',
			});
		} else {
			// Add createdAt if timestamps enabled (only in active view)
			const hasCreatedAt =
				col.timestamps === true ||
				(typeof col.timestamps === 'object' && col.timestamps.createdAt !== false);
			if (hasCreatedAt && columns.length < 6) {
				columns.push({
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					field: 'createdAt' as keyof T & string,
					header: 'Created',
					sortable: true,
					type: 'datetime',
					width: '150px',
				});
			}
		}

		return columns;
	});

	/** Convert row actions to DataTable format */
	readonly tableRowActions = computed((): DataTableRowAction<T>[] => {
		const actions = this.rowActions();
		return mapEntityActionsToRowActions<T>(actions);
	});

	/** Track entities by ID */
	readonly trackById = (item: T): string | number => item.id;

	/** Can user create entities */
	readonly canCreate = computed(() => {
		return this.collectionAccess.canCreate(this.collection().slug);
	});

	/** Can user delete entities */
	readonly canDelete = computed(() => {
		return this.collectionAccess.canDelete(this.collection().slug);
	});

	private previousCollectionSlug: string | null = null;

	constructor() {
		// Initialize search and sort from URL params
		const queryParams = this.route.snapshot.queryParams;

		// Initialize search (type guard for string)
		const initialSearch = queryParams['search'];
		if (typeof initialSearch === 'string') {
			this.searchQuery.set(initialSearch);
		}

		// Initialize sort from URL (format: "field" for asc, "-field" for desc)
		const initialSort = queryParams['sort'];
		if (typeof initialSort === 'string' && initialSort) {
			const isDesc = initialSort.startsWith('-');
			const field = isDesc ? initialSort.slice(1) : initialSort;
			// field is already a string, which satisfies DataTableSort<T>['field'] = keyof T | string
			this.sort.set({
				field,
				direction: isDesc ? 'desc' : 'asc',
			});
		}

		// Load data when collection, pagination, or trash view changes
		effect(() => {
			const col = this.collection();
			const page = this.currentPage();
			const trash = this.viewingTrash();
			let sortState = this.sort();
			let search = this.searchQuery();

			if (col) {
				// Clear search and sort when collection changes (synchronously before data load)
				if (this.previousCollectionSlug !== null && this.previousCollectionSlug !== col.slug) {
					this.searchQuery.set('');
					this.sort.set(undefined);
					this.currentPage.set(1);
					this.viewingTrash.set(false);
					search = '';
					sortState = undefined;
					// Clear URL params
					this.router.navigate([], {
						queryParams: { search: null, sort: null },
						queryParamsHandling: 'merge',
						replaceUrl: true,
					});
				}
				this.previousCollectionSlug = col.slug;

				this.loadData(col.slug, page, sortState, search, trash);
			}
		});
	}

	/**
	 * Load data from API.
	 */
	private async loadData(
		slug: string,
		page: number,
		sortState?: DataTableSort<T>,
		search?: string,
		onlyDeleted?: boolean,
	): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const options: Record<string, unknown> = {
				page,
				limit: this.pageSize(),
				depth: 1,
			};

			if (onlyDeleted) {
				options['onlyDeleted'] = true;
			}

			if (sortState) {
				options['sort'] =
					sortState.direction === 'desc' ? `-${String(sortState.field)}` : String(sortState.field);
			}

			if (search) {
				// Build where clause for search
				const searchFields =
					this.searchFields().length > 0 ? this.searchFields() : this.getDefaultSearchFields();

				if (searchFields.length > 0) {
					options['where'] = {
						or: searchFields.map((field) => ({
							[field]: { contains: search },
						})),
					};
				}
			}

			const result = await this.api.collection<T>(slug).find(options);
			this.entities.set(result.docs);
			this.totalItems.set(result.totalDocs);
			this.dataLoaded.emit(result);
		} catch {
			this.error.set('Failed to load data');
			this.entities.set([]);
			this.totalItems.set(0);
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Get default search fields from collection.
	 */
	private getDefaultSearchFields(): string[] {
		const col = this.collection();
		const fields: string[] = [];

		for (const field of col.fields) {
			if (field.type === 'text' || field.type === 'textarea' || field.type === 'email') {
				fields.push(field.name);
				if (fields.length >= 3) break; // Limit search fields
			}
		}

		return fields;
	}

	/**
	 * Determine if a field should be shown in the list.
	 */
	private shouldShowFieldInList(field: Field): boolean {
		// Skip hidden fields
		if (field.admin?.hidden) return false;

		// Skip blocks (too complex for table cells)
		if (field.type === 'blocks') return false;

		// Skip richText (too long for table cells)
		if (field.type === 'richText') return false;

		return true;
	}

	/**
	 * Convert a collection field to a table column.
	 */
	private fieldToColumn(
		field: Field,
		complexTemplate?: TemplateRef<DataTableCellContext<T>>,
	): EntityListColumn<T> {
		const column: EntityListColumn<T> = {
			// Field name is a valid key on the entity type
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			field: field.name as keyof T & string,
			header: field.label || field.name,
			sortable:
				field.type !== 'array' &&
				field.type !== 'relationship' &&
				field.type !== 'group' &&
				field.type !== 'json',
			type: FIELD_TYPE_TO_COLUMN_TYPE[field.type] || 'text',
		};

		// Set width for specific types
		if (field.type === 'checkbox') {
			column.width = '80px';
			column.align = 'center';
		} else if (field.type === 'date') {
			column.width = '120px';
		} else if (field.type === 'number') {
			column.width = '100px';
			column.align = 'right';
		} else if (field.type === 'group' || field.type === 'array' || field.type === 'json') {
			column.width = '150px';
		}

		// Use complex cell template for group, array, and json fields
		if (
			complexTemplate &&
			(field.type === 'group' || field.type === 'array' || field.type === 'json')
		) {
			column.template = complexTemplate;
		} else if (field.type === 'number' && field.displayFormat) {
			// Use Intl.NumberFormat for formatted numbers
			const fmt = field.displayFormat;
			column.render = (value: unknown) => {
				if (value === null || value === undefined) return '-';
				const num = Number(value);
				if (isNaN(num)) return String(value);
				const options: Intl.NumberFormatOptions = {};
				if (fmt.style) options.style = fmt.style;
				if (fmt.currency) options.currency = fmt.currency;
				if (fmt.minimumFractionDigits !== undefined)
					options.minimumFractionDigits = fmt.minimumFractionDigits;
				if (fmt.maximumFractionDigits !== undefined)
					options.maximumFractionDigits = fmt.maximumFractionDigits;
				return new Intl.NumberFormat(fmt.locale, options).format(num);
			};
		} else if (field.type === 'date' && field.displayFormat) {
			// Use Intl.DateTimeFormat for formatted dates
			const fmt = field.displayFormat;
			column.render = (value: unknown) => {
				if (value === null || value === undefined) return '-';
				const date = new Date(String(value));
				if (isNaN(date.getTime())) return String(value);
				const options: Intl.DateTimeFormatOptions = {};
				if (fmt.preset) options.dateStyle = fmt.preset;
				if (fmt.includeTime && fmt.timePreset) options.timeStyle = fmt.timePreset;
				return new Intl.DateTimeFormat(fmt.locale, options).format(date);
			};
		} else {
			// Default render function
			column.render = (value: unknown) => this.formatValue(value, column.type);
		}

		return column;
	}

	/**
	 * Format a value based on its type.
	 */
	private formatValue(value: unknown, type?: EntityListColumn['type']): string {
		if (value === null || value === undefined) return '-';

		switch (type) {
			case 'date': {
				const dateStr = typeof value === 'string' ? value : String(value);
				return new Date(dateStr).toLocaleDateString();
			}
			case 'datetime': {
				const dtStr = typeof value === 'string' ? value : String(value);
				return new Date(dtStr).toLocaleString();
			}
			case 'boolean':
				return value ? 'Yes' : 'No';
			case 'array':
				return Array.isArray(value) ? `${value.length} item${value.length !== 1 ? 's' : ''}` : '-';
			case 'group': {
				if (typeof value === 'object' && value !== null) {
					const keys = Object.keys(value);
					return `${keys.length} field${keys.length !== 1 ? 's' : ''}`;
				}
				return '-';
			}
			case 'json': {
				if (typeof value === 'object' && value !== null) {
					const keys = Object.keys(value);
					return `${keys.length} key${keys.length !== 1 ? 's' : ''}`;
				}
				return String(value);
			}
			case 'relationship': {
				if (typeof value === 'object' && value !== null && 'id' in value) {
					// Access object properties directly after type narrowing
					const obj = value;
					const title = 'title' in obj ? obj.title : undefined;
					const name = 'name' in obj ? obj.name : undefined;
					return String(title || name || obj.id);
				}
				return String(value);
			}
			default: {
				// Truncate long text
				const str = String(value);
				return str.length > 100 ? `${str.slice(0, 100)}...` : str;
			}
		}
	}

	/**
	 * Generate a brief summary string for complex field values (group, array, json).
	 */
	getComplexSummary(value: unknown, type?: string): string {
		if (value === null || value === undefined) return '-';
		if (Array.isArray(value)) {
			return `${value.length} item${value.length !== 1 ? 's' : ''}`;
		}
		if (typeof value === 'object') {
			const keys = Object.keys(value);
			if (type === 'group') {
				return `${keys.length} field${keys.length !== 1 ? 's' : ''}`;
			}
			return `${keys.length} key${keys.length !== 1 ? 's' : ''}`;
		}
		return String(value);
	}

	/**
	 * Open a dialog to preview the full data for a complex field.
	 */
	openDataPreview(value: unknown, fieldName: string | number | symbol): void {
		const col = this.collection();
		const name = String(fieldName);
		const field = col.fields.find((f) => f.name === name);
		const title = field?.label ?? humanizeFieldName(name);

		let displayType: DataPreviewDialogData['type'] = 'json';
		let fieldMeta: FieldDisplayFieldMeta[] = [];

		if (field?.type === 'group') {
			displayType = 'group';
			fieldMeta = field.fields
				.filter((f) => !f.admin?.hidden)
				.map((f) => ({
					name: f.name,
					label: f.label ?? humanizeFieldName(f.name),
					type: f.type,
				}));
		} else if (field?.type === 'array') {
			displayType = 'array-table';
			fieldMeta = field.fields
				.filter((f) => !f.admin?.hidden)
				.map((f) => ({
					name: f.name,
					label: f.label ?? humanizeFieldName(f.name),
					type: f.type,
				}));
		}

		this.dialog.open<DataPreviewDialog, DataPreviewDialogData>(DataPreviewDialog, {
			data: { title, value, type: displayType, fieldMeta },
			width: '40rem',
		});
	}

	/**
	 * Handle row click.
	 */
	onRowClick(entity: T): void {
		this.entityClick.emit(entity);
		// Navigate to entity view/edit by default
		const path = `${this.basePath()}/${this.collection().slug}/${entity.id}`;
		this.router.navigate([path]);
	}

	/**
	 * Handle row action.
	 */
	onRowAction(event: DataTableRowActionEvent<T>): void {
		const action = this.rowActions().find((a) => a.id === event.action.id);
		if (action) {
			this.entityAction.emit({ action, entity: event.item });
		}
	}

	/**
	 * Handle bulk action.
	 */
	async onBulkAction(action: EntityAction): Promise<void> {
		const selected = this.selectedEntities();

		if (action.requiresConfirmation) {
			if (action.id === 'delete') {
				const confirmed = await this.feedback.confirmBulkDelete(
					this.collectionLabel(),
					selected.length,
				);
				if (!confirmed) return;
			}
		}

		this.bulkAction.emit({ action, entities: selected });

		// Clear selection after bulk action
		this.selectedEntities.set([]);
	}

	/**
	 * Handle search change.
	 */
	onSearchChange(query: string): void {
		this.searchQuery.set(query);
		this.currentPage.set(1); // Reset to first page on search

		// Sync search to URL (use replaceUrl to avoid polluting browser history)
		this.router.navigate([], {
			queryParams: { search: query || null },
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});
	}

	/**
	 * Handle page change.
	 */
	onPageChange(page: number): void {
		this.currentPage.set(page);
	}

	/**
	 * Handle sort change.
	 */
	onSortChange(sortState: DataTableSort<T> | undefined): void {
		this.sort.set(sortState);
		if (sortState) {
			this.currentPage.set(1); // Reset to first page on sort
		}

		// Sync sort to URL (format: "field" for asc, "-field" for desc)
		const sortParam = sortState
			? sortState.direction === 'desc'
				? `-${String(sortState.field)}`
				: String(sortState.field)
			: null;

		this.router.navigate([], {
			queryParams: { sort: sortParam },
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});
	}

	/**
	 * Reload data.
	 */
	reload(): void {
		const col = this.collection();
		if (col) {
			this.loadData(
				col.slug,
				this.currentPage(),
				this.sort(),
				this.searchQuery(),
				this.viewingTrash(),
			);
		}
	}

	/**
	 * Toggle between active and trash views.
	 */
	toggleTrashView(): void {
		this.viewingTrash.update((v) => !v);
		this.currentPage.set(1);
		this.selectedEntities.set([]);
	}

	/**
	 * Handle create button click.
	 */
	onCreateClick(): void {
		const path = `${this.basePath()}/${this.collection().slug}/new`;
		this.router.navigate([path]);
	}
}

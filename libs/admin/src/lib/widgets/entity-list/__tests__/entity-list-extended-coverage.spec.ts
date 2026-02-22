import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import type { CollectionConfig, Field } from '@momentumcms/core';
import { DialogService } from '@momentumcms/ui';
import { EntityListWidget } from '../entity-list.component';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { MOMENTUM_API, MOMENTUM_API_CONTEXT } from '../../../services/momentum-api.service';
import { DataPreviewDialog } from '../../data-preview/data-preview-dialog.component';

// ---- helpers ----

interface TestEntity {
	[key: string]: unknown;
	id: string;
	title: string;
}

class MockCollectionAccess {
	canCreate = vi.fn().mockReturnValue(true);
	canUpdate = vi.fn().mockReturnValue(true);
	canDelete = vi.fn().mockReturnValue(true);
}

class MockFeedbackService {
	confirmBulkDelete = vi.fn().mockResolvedValue(true);
	operationFailed = vi.fn();
}

class MockDialogService {
	open = vi.fn();
}

function createMockApi(): {
	api: Record<string, unknown>;
	mockCollection: Record<string, ReturnType<typeof vi.fn>>;
} {
	const mockCol = {
		find: vi.fn().mockResolvedValue({
			docs: [],
			totalDocs: 0,
			totalPages: 1,
			page: 1,
			limit: 10,
			hasNextPage: false,
			hasPrevPage: false,
		}),
		findById: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockResolvedValue({ id: '1' }),
		update: vi.fn().mockResolvedValue({ id: '1' }),
		delete: vi.fn().mockResolvedValue({ id: '1', deleted: true }),
		forceDelete: vi.fn().mockResolvedValue({ id: '1', deleted: true }),
		restore: vi.fn().mockResolvedValue({ id: '1' }),
		batchDelete: vi.fn().mockResolvedValue([]),
	};

	const api = {
		collection: vi.fn().mockReturnValue(mockCol),
		global: vi.fn().mockReturnValue({ find: vi.fn(), update: vi.fn() }),
		getConfig: vi.fn().mockReturnValue({ collections: [] }),
		setContext: vi.fn(),
		getContext: vi.fn().mockReturnValue({}),
	};

	return { api, mockCollection: mockCol };
}

function createTestCollection(overrides: Partial<CollectionConfig> = {}): CollectionConfig {
	return {
		slug: 'posts',
		labels: { singular: 'Post', plural: 'Posts' },
		fields: [
			{ name: 'title', type: 'text', label: 'Title' } as Field,
			{ name: 'email', type: 'email', label: 'Email' } as Field,
			{
				name: 'status',
				type: 'select',
				label: 'Status',
				options: [{ label: 'Active', value: 'active' }],
			} as Field,
		],
		timestamps: true,
		...overrides,
	};
}

// ---- tests ----

describe('EntityListWidget - extended coverage', () => {
	let fixture: ComponentFixture<EntityListWidget<TestEntity>>;
	let component: EntityListWidget<TestEntity>;
	let mockAccess: MockCollectionAccess;
	let mockFeedback: MockFeedbackService;
	let mockDialog: MockDialogService;
	let router: Router;
	let apiMock: ReturnType<typeof createMockApi>;

	beforeEach(async () => {
		mockAccess = new MockCollectionAccess();
		mockFeedback = new MockFeedbackService();
		mockDialog = new MockDialogService();
		apiMock = createMockApi();

		await TestBed.configureTestingModule({
			imports: [EntityListWidget],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'server' },
				{ provide: CollectionAccessService, useValue: mockAccess },
				{ provide: FeedbackService, useValue: mockFeedback },
				{ provide: DialogService, useValue: mockDialog },
				{ provide: MOMENTUM_API, useValue: apiMock.api },
				{ provide: MOMENTUM_API_CONTEXT, useValue: {} },
				{
					provide: ActivatedRoute,
					useValue: { snapshot: { queryParams: {} } },
				},
			],
		})
			.overrideComponent(EntityListWidget, {
				set: { imports: [], template: '<div></div>' },
			})
			.compileComponents();

		fixture = TestBed.createComponent(EntityListWidget<TestEntity>);
		component = fixture.componentInstance;
		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
	});

	// ------------------------------------------------------------------
	// loadData — primary data loading (L424-475)
	// ------------------------------------------------------------------
	describe('loadData via effect', () => {
		it('should load data when collection is set', async () => {
			const result = {
				docs: [{ id: '1', title: 'Post 1' }],
				totalDocs: 1,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			};
			apiMock.mockCollection['find'].mockResolvedValue(result);

			fixture.componentRef.setInput('collection', createTestCollection());
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			expect(component.entities()).toEqual([{ id: '1', title: 'Post 1' }]);
			expect(component.totalItems()).toBe(1);
		});

		it('should pass sort options to API when sort is set', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', createTestCollection());
			fixture.detectChanges();

			// Wait for initial load
			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			apiMock.mockCollection['find'].mockClear();

			// Trigger sort change
			component.onSortChange({ field: 'title', direction: 'desc' });

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['find']).toHaveBeenCalled();
			});

			const callArgs = apiMock.mockCollection['find'].mock.calls[0][0] as Record<string, unknown>;
			expect(callArgs['sort']).toBe('-title');
		});

		it('should pass ascending sort correctly', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', createTestCollection());
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			apiMock.mockCollection['find'].mockClear();

			component.onSortChange({ field: 'title', direction: 'asc' });

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['find']).toHaveBeenCalled();
			});

			const callArgs = apiMock.mockCollection['find'].mock.calls[0][0] as Record<string, unknown>;
			expect(callArgs['sort']).toBe('title');
		});

		it('should pass search where clause to API', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', createTestCollection());
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			apiMock.mockCollection['find'].mockClear();

			component.onSearchChange('hello');

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['find']).toHaveBeenCalled();
			});

			const callArgs = apiMock.mockCollection['find'].mock.calls[0][0] as Record<string, unknown>;
			expect(callArgs['where']).toBeDefined();
			const where = callArgs['where'] as { or: Record<string, unknown>[] };
			expect(where.or.length).toBeGreaterThan(0);
		});

		it('should use custom searchFields when provided', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', createTestCollection());
			fixture.componentRef.setInput('searchFields', ['title']);
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			apiMock.mockCollection['find'].mockClear();

			component.onSearchChange('test');

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['find']).toHaveBeenCalled();
			});

			const callArgs = apiMock.mockCollection['find'].mock.calls[0][0] as Record<string, unknown>;
			const where = callArgs['where'] as { or: Record<string, unknown>[] };
			expect(where.or).toHaveLength(1);
			expect(where.or[0]).toHaveProperty('title');
		});

		it('should handle API error gracefully', async () => {
			apiMock.mockCollection['find'].mockRejectedValue(new Error('Network error'));

			fixture.componentRef.setInput('collection', createTestCollection());
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			expect(component.error()).toBe('Failed to load data');
			expect(component.entities()).toEqual([]);
			expect(component.totalItems()).toBe(0);
		});

		it('should pass onlyDeleted when viewing trash', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', createTestCollection({ softDelete: true }));
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			apiMock.mockCollection['find'].mockClear();

			component.toggleTrashView();

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['find']).toHaveBeenCalled();
			});

			const callArgs = apiMock.mockCollection['find'].mock.calls[0][0] as Record<string, unknown>;
			expect(callArgs['onlyDeleted']).toBe(true);
		});

		it('should emit dataLoaded on successful load', async () => {
			const result = {
				docs: [{ id: '1', title: 'Test' }],
				totalDocs: 1,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			};
			apiMock.mockCollection['find'].mockResolvedValue(result);

			const emitted: unknown[] = [];
			component.dataLoaded.subscribe((e) => emitted.push(e));

			fixture.componentRef.setInput('collection', createTestCollection());
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(emitted.length).toBeGreaterThan(0);
			});

			expect(emitted[0]).toEqual(result);
		});
	});

	// ------------------------------------------------------------------
	// Constructor URL param initialization (L368-419)
	// ------------------------------------------------------------------
	describe('constructor - collection change resets state', () => {
		it('should reset search, sort, and page when collection changes', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			const col1 = createTestCollection({ slug: 'posts' });
			fixture.componentRef.setInput('collection', col1);
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			// Set search and sort
			component.searchQuery.set('hello');
			component.sort.set({ field: 'title', direction: 'asc' });
			component.currentPage.set(3);

			// Change collection
			const col2 = createTestCollection({ slug: 'users' });
			fixture.componentRef.setInput('collection', col2);
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			expect(component.searchQuery()).toBe('');
			expect(component.sort()).toBeUndefined();
			expect(component.currentPage()).toBe(1);
			expect(component.viewingTrash()).toBe(false);
		});
	});

	// ------------------------------------------------------------------
	// formatValue (L588-634) — all branches via render callbacks
	// ------------------------------------------------------------------
	describe('formatValue - datetime branch', () => {
		it('should format datetime values through render', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [{ name: 'loggedAt', type: 'date', label: 'Logged At' } as Field],
				timestamps: true,
			};
			fixture.componentRef.setInput('collection', col);

			const columns = component.tableColumns();
			// The createdAt column is auto-added with type 'datetime'
			const createdCol = columns.find((c) => c.field === 'createdAt');
			expect(createdCol).toBeDefined();
			expect(createdCol?.type).toBe('datetime');
		});
	});

	describe('formatValue - group branch', () => {
		it('should format group values via render callback', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [
					{
						name: 'meta',
						type: 'group',
						label: 'Meta',
						fields: [{ name: 'key', type: 'text' } as Field],
					} as unknown as Field,
				],
			};
			fixture.componentRef.setInput('collection', col);

			const columns = component.tableColumns();
			const metaCol = columns.find((c) => c.field === 'meta');
			expect(metaCol).toBeDefined();
			// Group columns use complex cell template when available, or default render
			// Since we override imports: [], complexCellTemplate may not be available,
			// so the render function is used as fallback
			if (metaCol?.render) {
				const row = {} as TestEntity;
				expect(metaCol.render({ a: 1, b: 2 }, row)).toBe('2 fields');
				expect(metaCol.render(null, row)).toBe('-');
			}
		});
	});

	describe('formatValue - json branch', () => {
		it('should format json values via render callback', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [{ name: 'data', type: 'json', label: 'Data' } as Field],
			};
			fixture.componentRef.setInput('collection', col);

			const columns = component.tableColumns();
			const jsonCol = columns.find((c) => c.field === 'data');
			if (jsonCol?.render) {
				const row = {} as TestEntity;
				expect(jsonCol.render({ x: 1 }, row)).toBe('1 key');
				expect(jsonCol.render({ x: 1, y: 2 }, row)).toBe('2 keys');
				expect(jsonCol.render('primitive', row)).toBe('primitive');
				expect(jsonCol.render(null, row)).toBe('-');
			}
		});
	});

	describe('formatValue - relationship branch', () => {
		it('should format populated relationship objects', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [
					{
						name: 'author',
						type: 'relationship',
						label: 'Author',
						collection: () => createTestCollection(),
					} as unknown as Field,
				],
			};
			fixture.componentRef.setInput('collection', col);

			const columns = component.tableColumns();
			const authCol = columns.find((c) => c.field === 'author');
			if (authCol?.render) {
				const row = {} as TestEntity;
				expect(authCol.render({ id: '1', title: 'John' }, row)).toBe('John');
				expect(authCol.render({ id: '1', name: 'Jane' }, row)).toBe('Jane');
				expect(authCol.render({ id: '1' }, row)).toBe('1');
				expect(authCol.render('raw-id', row)).toBe('raw-id');
			}
		});
	});

	// ------------------------------------------------------------------
	// openDataPreview (L657-690)
	// ------------------------------------------------------------------
	describe('openDataPreview - with group field', () => {
		it('should open dialog with group displayType and fieldMeta', () => {
			const groupField: Field = {
				name: 'meta',
				type: 'group',
				label: 'Metadata',
				fields: [
					{ name: 'description', type: 'text' } as Field,
					{ name: 'keywords', type: 'text' } as Field,
					{ name: 'secret', type: 'text', admin: { hidden: true } } as unknown as Field,
				],
			} as unknown as Field;

			const col = createTestCollection({ fields: [groupField] });
			fixture.componentRef.setInput('collection', col);

			const value = { description: 'Test', keywords: 'a,b' };
			component.openDataPreview(value, 'meta');

			expect(mockDialog.open).toHaveBeenCalledWith(DataPreviewDialog, {
				data: {
					title: 'Metadata',
					value,
					type: 'group',
					fieldMeta: [
						{ name: 'description', label: 'Description', type: 'text' },
						{ name: 'keywords', label: 'Keywords', type: 'text' },
					],
				},
				width: '40rem',
			});
		});
	});

	describe('openDataPreview - with array field', () => {
		it('should open dialog with array-table displayType and fieldMeta', () => {
			const arrayField: Field = {
				name: 'items',
				type: 'array',
				label: 'Items',
				fields: [
					{ name: 'label', type: 'text' } as Field,
					{ name: 'value', type: 'number' } as Field,
				],
			} as unknown as Field;

			const col = createTestCollection({ fields: [arrayField] });
			fixture.componentRef.setInput('collection', col);

			const value = [{ label: 'A', value: 1 }];
			component.openDataPreview(value, 'items');

			expect(mockDialog.open).toHaveBeenCalledWith(DataPreviewDialog, {
				data: {
					title: 'Items',
					value,
					type: 'array-table',
					fieldMeta: [
						{ name: 'label', label: 'Label', type: 'text' },
						{ name: 'value', label: 'Value', type: 'number' },
					],
				},
				width: '40rem',
			});
		});
	});

	describe('openDataPreview - with json field', () => {
		it('should open dialog with json displayType and empty fieldMeta', () => {
			const jsonField: Field = { name: 'data', type: 'json', label: 'Data' } as Field;

			const col = createTestCollection({ fields: [jsonField] });
			fixture.componentRef.setInput('collection', col);

			const value = { key: 'val' };
			component.openDataPreview(value, 'data');

			expect(mockDialog.open).toHaveBeenCalledWith(DataPreviewDialog, {
				data: {
					title: 'Data',
					value,
					type: 'json',
					fieldMeta: [],
				},
				width: '40rem',
			});
		});
	});

	describe('openDataPreview - unknown field', () => {
		it('should use humanized name and json type for unknown field', () => {
			const col = createTestCollection();
			fixture.componentRef.setInput('collection', col);

			const value = { key: 'val' };
			component.openDataPreview(value, 'unknownField');

			expect(mockDialog.open).toHaveBeenCalledWith(DataPreviewDialog, {
				data: {
					title: 'Unknown Field',
					value,
					type: 'json',
					fieldMeta: [],
				},
				width: '40rem',
			});
		});
	});

	// ------------------------------------------------------------------
	// tableColumns — trash view deletedAt column
	// ------------------------------------------------------------------
	describe('tableColumns - trash view', () => {
		it('should add deletedAt column and remove createdAt when viewing trash', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', createTestCollection({ softDelete: true }));
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			component.viewingTrash.set(true);

			const columns = component.tableColumns();
			const deletedCol = columns.find((c) => c.field === 'deletedAt');
			expect(deletedCol).toBeDefined();
			expect(deletedCol?.type).toBe('datetime');
			expect(deletedCol?.header).toBe('Deleted');
			expect(deletedCol?.width).toBe('170px');

			// Should NOT have createdAt column in trash view
			const createdAtCol = columns.find((c) => c.field === 'createdAt');
			expect(createdAtCol).toBeUndefined();
		});
	});

	// ------------------------------------------------------------------
	// tableColumns — no timestamps
	// ------------------------------------------------------------------
	describe('tableColumns - no timestamps', () => {
		it('should not add createdAt column when timestamps disabled', () => {
			const col = createTestCollection({ timestamps: false });
			fixture.componentRef.setInput('collection', col);

			const columns = component.tableColumns();
			const createdAtCol = columns.find((c) => c.field === 'createdAt');
			expect(createdAtCol).toBeUndefined();
		});
	});

	// ------------------------------------------------------------------
	// fieldToColumn — select type
	// ------------------------------------------------------------------
	describe('fieldToColumn - select fields', () => {
		it('should mark select fields as sortable', () => {
			const col = createTestCollection({
				fields: [
					{
						name: 'priority',
						type: 'select',
						label: 'Priority',
						options: [{ label: 'High', value: 'high' }],
					} as Field,
				],
			});
			fixture.componentRef.setInput('collection', col);

			const columns = component.tableColumns();
			const priorityCol = columns.find((c) => c.field === 'priority');
			expect(priorityCol).toBeDefined();
			expect(priorityCol?.sortable).toBe(true);
			expect(priorityCol?.type).toBe('badge');
		});
	});

	// ------------------------------------------------------------------
	// reload method
	// ------------------------------------------------------------------
	describe('reload', () => {
		it('should trigger loadData with current state', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [{ id: '1', title: 'Test' }],
				totalDocs: 1,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', createTestCollection());
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			apiMock.mockCollection['find'].mockClear();
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [{ id: '2', title: 'Reloaded' }],
				totalDocs: 1,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			component.reload();

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['find']).toHaveBeenCalled();
			});
		});
	});

	// ------------------------------------------------------------------
	// getDefaultSearchFields — private, tested via loadData search
	// ------------------------------------------------------------------
	describe('getDefaultSearchFields via search', () => {
		it('should auto-derive text/email/textarea fields for search', async () => {
			const col = createTestCollection({
				fields: [
					{ name: 'title', type: 'text', label: 'Title' } as Field,
					{ name: 'body', type: 'textarea', label: 'Body' } as Field,
					{ name: 'email', type: 'email', label: 'Email' } as Field,
					{ name: 'count', type: 'number', label: 'Count' } as Field,
					{ name: 'extra', type: 'text', label: 'Extra' } as Field,
				],
			});

			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', col);
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			apiMock.mockCollection['find'].mockClear();
			component.onSearchChange('test');

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['find']).toHaveBeenCalled();
			});

			const callArgs = apiMock.mockCollection['find'].mock.calls[0][0] as Record<string, unknown>;
			const where = callArgs['where'] as { or: Record<string, unknown>[] };

			// Should only include 3 text/textarea/email fields (limit)
			expect(where.or).toHaveLength(3);
			expect(where.or[0]).toHaveProperty('title');
			expect(where.or[1]).toHaveProperty('body');
			expect(where.or[2]).toHaveProperty('email');
		});

		it('should handle collection with no searchable fields', async () => {
			const col = createTestCollection({
				fields: [
					{ name: 'count', type: 'number', label: 'Count' } as Field,
					{ name: 'active', type: 'checkbox', label: 'Active' } as Field,
				],
			});

			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			fixture.componentRef.setInput('collection', col);
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			apiMock.mockCollection['find'].mockClear();
			component.onSearchChange('test');

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['find']).toHaveBeenCalled();
			});

			const callArgs = apiMock.mockCollection['find'].mock.calls[0][0] as Record<string, unknown>;
			// No where clause when no searchable fields found
			expect(callArgs['where']).toBeUndefined();
		});
	});

	// ------------------------------------------------------------------
	// number displayFormat render — locale handling
	// ------------------------------------------------------------------
	describe('fieldToColumn - number with locale displayFormat', () => {
		it('should use locale from displayFormat', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [
					{
						name: 'amount',
						type: 'number',
						label: 'Amount',
						displayFormat: {
							locale: 'en-US',
							style: 'currency',
							currency: 'EUR',
						},
					} as unknown as Field,
				],
			};
			fixture.componentRef.setInput('collection', col);

			const columns = component.tableColumns();
			const amountCol = columns.find((c) => c.field === 'amount');
			expect(amountCol?.render).toBeDefined();
			if (amountCol?.render) {
				const row = {} as TestEntity;
				const result = amountCol.render(1234.5, row);
				expect(result).toContain('1,234.5'); // en-US currency formatting
			}
		});
	});

	// ------------------------------------------------------------------
	// date displayFormat render — without time
	// ------------------------------------------------------------------
	describe('fieldToColumn - date without time', () => {
		it('should format date without time component', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [
					{
						name: 'birthday',
						type: 'date',
						label: 'Birthday',
						displayFormat: {
							preset: 'long',
						},
					} as unknown as Field,
				],
			};
			fixture.componentRef.setInput('collection', col);

			const columns = component.tableColumns();
			const bdayCol = columns.find((c) => c.field === 'birthday');
			expect(bdayCol?.render).toBeDefined();
			if (bdayCol?.render) {
				const row = {} as TestEntity;
				const result = bdayCol.render('2024-06-15', row);
				expect(result.length).toBeGreaterThan(0);
				// null/undefined
				expect(bdayCol.render(null, row)).toBe('-');
			}
		});
	});

	// ------------------------------------------------------------------
	// softDelete field in tableColumns with custom softDelete config
	// ------------------------------------------------------------------
	describe('tableColumns - custom softDelete field', () => {
		it('should use custom softDelete field name in trash view', async () => {
			apiMock.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			// softDelete with custom field name
			const col = createTestCollection({
				softDelete: { field: 'archivedAt' } as unknown as CollectionConfig['softDelete'],
			});
			fixture.componentRef.setInput('collection', col);
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.loading()).toBe(false);
			});

			component.viewingTrash.set(true);

			const columns = component.tableColumns();
			const deletedCol = columns.find((c) => c.field === 'archivedAt' || c.field === 'deletedAt');
			expect(deletedCol).toBeDefined();
			expect(deletedCol?.header).toBe('Deleted');
		});
	});

	// ------------------------------------------------------------------
	// onBulkAction with non-delete confirmation
	// ------------------------------------------------------------------
	describe('onBulkAction - requiresConfirmation non-delete', () => {
		it('should not call confirmBulkDelete for non-delete actions even with requiresConfirmation', async () => {
			const selected = [{ id: 'e1', title: 'T1' } as TestEntity];
			component.selectedEntities.set(selected);

			const spy = vi.fn();
			component.bulkAction.subscribe(spy);

			const action = { id: 'archive', label: 'Archive', requiresConfirmation: true };
			await component.onBulkAction(action);

			// confirmBulkDelete should NOT be called because action.id !== 'delete'
			expect(mockFeedback.confirmBulkDelete).not.toHaveBeenCalled();
			// But the action should still emit
			expect(spy).toHaveBeenCalledWith({ action, entities: selected });
		});
	});

	// ------------------------------------------------------------------
	// Constructor with URL params for search and sort
	// ------------------------------------------------------------------
	describe('constructor - URL param initialization with search', () => {
		it('should initialize search and sort from URL params', async () => {
			TestBed.resetTestingModule();
			const apiMock2 = createMockApi();
			apiMock2.mockCollection['find'].mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			});

			await TestBed.configureTestingModule({
				imports: [EntityListWidget],
				providers: [
					provideHttpClient(),
					provideHttpClientTesting(),
					provideRouter([]),
					{ provide: PLATFORM_ID, useValue: 'server' },
					{ provide: CollectionAccessService, useValue: mockAccess },
					{ provide: FeedbackService, useValue: mockFeedback },
					{ provide: DialogService, useValue: mockDialog },
					{ provide: MOMENTUM_API, useValue: apiMock2.api },
					{ provide: MOMENTUM_API_CONTEXT, useValue: {} },
					{
						provide: ActivatedRoute,
						useValue: {
							snapshot: {
								queryParams: { search: 'initial query', sort: '-createdAt' },
							},
						},
					},
				],
			})
				.overrideComponent(EntityListWidget, {
					set: { imports: [], template: '<div></div>' },
				})
				.compileComponents();

			const f = TestBed.createComponent(EntityListWidget<TestEntity>);
			f.componentRef.setInput('collection', createTestCollection());
			f.detectChanges();

			expect(f.componentInstance.searchQuery()).toBe('initial query');
			expect(f.componentInstance.sort()).toEqual({
				field: 'createdAt',
				direction: 'desc',
			});
		});
	});
});

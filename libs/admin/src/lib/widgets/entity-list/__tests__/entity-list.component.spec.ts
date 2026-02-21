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
import type { EntityAction } from '../../widget.types';

interface TestEntity {
	[key: string]: unknown;
	id: string;
	title: string;
	email?: string;
	status?: string;
	createdAt?: string;
	count?: number;
	tags?: string[];
	metadata?: Record<string, unknown>;
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

const testCollection: CollectionConfig = {
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
		{ name: 'count', type: 'number', label: 'Count' } as Field,
		{ name: 'tags', type: 'array', label: 'Tags', fields: [] } as unknown as Field,
		{ name: 'hidden', type: 'text', label: 'Hidden', admin: { hidden: true } } as unknown as Field,
		{ name: 'content', type: 'richText', label: 'Content' } as Field,
		{ name: 'blocks', type: 'blocks', label: 'Blocks', blocks: [] } as unknown as Field,
	],
	timestamps: true,
};

describe('EntityListWidget', () => {
	let fixture: ComponentFixture<EntityListWidget<TestEntity>>;
	let component: EntityListWidget<TestEntity>;
	let mockAccess: MockCollectionAccess;
	let mockFeedback: MockFeedbackService;
	let mockDialog: MockDialogService;
	let router: Router;

	beforeEach(async () => {
		mockAccess = new MockCollectionAccess();
		mockFeedback = new MockFeedbackService();
		mockDialog = new MockDialogService();

		await TestBed.configureTestingModule({
			imports: [EntityListWidget],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: CollectionAccessService, useValue: mockAccess },
				{ provide: FeedbackService, useValue: mockFeedback },
				{ provide: DialogService, useValue: mockDialog },
				{
					provide: ActivatedRoute,
					useValue: { snapshot: { queryParams: {} } },
				},
			],
		})
			.overrideComponent(EntityListWidget, {
				set: { template: '<div></div>', imports: [] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(EntityListWidget<TestEntity>);
		component = fixture.componentInstance;
		router = TestBed.inject(Router);
		fixture.componentRef.setInput('collection', testCollection);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('computed labels', () => {
		it('should compute collectionLabel from labels.plural', () => {
			expect(component.collectionLabel()).toBe('Posts');
		});

		it('should compute collectionLabelSingular from labels.singular', () => {
			expect(component.collectionLabelSingular()).toBe('Post');
		});

		it('should fallback to slug when no labels', () => {
			fixture.componentRef.setInput('collection', { ...testCollection, labels: undefined });
			expect(component.collectionLabel()).toBe('Posts');
		});

		it('should compute dashboardPath', () => {
			fixture.componentRef.setInput('basePath', '/admin/collections');
			expect(component.dashboardPath()).toBe('/admin');
		});
	});

	describe('canCreate', () => {
		it('should return true when access allows', () => {
			expect(component.canCreate()).toBe(true);
			expect(mockAccess.canCreate).toHaveBeenCalledWith('posts');
		});

		it('should return false when access denies', () => {
			mockAccess.canCreate.mockReturnValue(false);
			expect(component.canCreate()).toBe(false);
		});
	});

	describe('canDelete', () => {
		it('should delegate to CollectionAccessService', () => {
			expect(component.canDelete()).toBe(true);
			expect(mockAccess.canDelete).toHaveBeenCalledWith('posts');
		});
	});

	describe('hasSoftDelete', () => {
		it('should return false for standard collection', () => {
			expect(component.hasSoftDelete()).toBe(false);
		});
	});

	describe('tableColumns', () => {
		it('should auto-derive columns from collection fields', () => {
			const columns = component.tableColumns();
			expect(columns.length).toBeGreaterThan(0);
		});

		it('should skip hidden fields', () => {
			const columns = component.tableColumns();
			const fieldNames = columns.map((c) => c.field);
			expect(fieldNames).not.toContain('hidden');
		});

		it('should skip richText fields', () => {
			const columns = component.tableColumns();
			const fieldNames = columns.map((c) => c.field);
			expect(fieldNames).not.toContain('content');
		});

		it('should skip blocks fields', () => {
			const columns = component.tableColumns();
			const fieldNames = columns.map((c) => c.field);
			expect(fieldNames).not.toContain('blocks');
		});

		it('should limit to 5 auto-derived columns', () => {
			const columns = component.tableColumns();
			// Only non-hidden, non-richText, non-blocks fields + createdAt
			const dataColumns = columns.filter((c) => c.field !== 'createdAt');
			expect(dataColumns.length).toBeLessThanOrEqual(5);
		});

		it('should add createdAt column when timestamps enabled', () => {
			const columns = component.tableColumns();
			const createdAtCol = columns.find((c) => c.field === 'createdAt');
			expect(createdAtCol).toBeDefined();
			expect(createdAtCol?.type).toBe('datetime');
		});

		it('should use custom columns when provided', () => {
			const custom = [{ field: 'title' as keyof TestEntity & string, header: 'Custom Title' }];
			fixture.componentRef.setInput('columns', custom);
			expect(component.tableColumns()).toEqual(custom);
		});

		it('should set correct column types', () => {
			const columns = component.tableColumns();
			const titleCol = columns.find((c) => c.field === 'title');
			const countCol = columns.find((c) => c.field === 'count');
			expect(titleCol?.type).toBe('text');
			expect(countCol?.type).toBe('number');
		});

		it('should set width for checkbox fields', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [{ name: 'active', type: 'checkbox', label: 'Active' } as Field],
			};
			fixture.componentRef.setInput('collection', col);
			const columns = component.tableColumns();
			const activeCol = columns.find((c) => c.field === 'active');
			expect(activeCol?.width).toBe('80px');
			expect(activeCol?.align).toBe('center');
		});

		it('should set width for date fields', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [{ name: 'dueDate', type: 'date', label: 'Due Date' } as Field],
			};
			fixture.componentRef.setInput('collection', col);
			const columns = component.tableColumns();
			const dateCol = columns.find((c) => c.field === 'dueDate');
			expect(dateCol?.width).toBe('120px');
		});

		it('should set width and align for number fields', () => {
			const columns = component.tableColumns();
			const numCol = columns.find((c) => c.field === 'count');
			expect(numCol?.width).toBe('100px');
			expect(numCol?.align).toBe('right');
		});

		it('should set width for group/array/json fields', () => {
			const columns = component.tableColumns();
			const arrCol = columns.find((c) => c.field === 'tags');
			expect(arrCol?.width).toBe('150px');
		});

		it('should set sortable false for array, relationship, group, json fields', () => {
			const columns = component.tableColumns();
			const arrCol = columns.find((c) => c.field === 'tags');
			expect(arrCol?.sortable).toBe(false);
		});
	});

	describe('tableRowActions', () => {
		it('should return empty array by default', () => {
			expect(component.tableRowActions()).toEqual([]);
		});

		it('should map row actions from input', () => {
			const actions: EntityAction[] = [{ id: 'delete', label: 'Delete', variant: 'destructive' }];
			fixture.componentRef.setInput('rowActions', actions);
			const result = component.tableRowActions();
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('delete');
			expect(result[0].variant).toBe('destructive');
		});
	});

	describe('trackById', () => {
		it('should return entity id', () => {
			expect(component.trackById({ id: 'abc', title: 'Test' })).toBe('abc');
		});
	});

	describe('getComplexSummary', () => {
		it('should return dash for null', () => {
			expect(component.getComplexSummary(null)).toBe('-');
		});

		it('should return dash for undefined', () => {
			expect(component.getComplexSummary(undefined)).toBe('-');
		});

		it('should summarize array', () => {
			expect(component.getComplexSummary([1, 2, 3])).toBe('3 items');
		});

		it('should handle single item array', () => {
			expect(component.getComplexSummary([1])).toBe('1 item');
		});

		it('should summarize group object', () => {
			expect(component.getComplexSummary({ a: 1, b: 2 }, 'group')).toBe('2 fields');
		});

		it('should summarize single-field group', () => {
			expect(component.getComplexSummary({ a: 1 }, 'group')).toBe('1 field');
		});

		it('should summarize json object with keys', () => {
			expect(component.getComplexSummary({ x: 1 }, 'json')).toBe('1 key');
		});

		it('should summarize non-group object as keys', () => {
			expect(component.getComplexSummary({ x: 1, y: 2 })).toBe('2 keys');
		});

		it('should stringify primitive values', () => {
			expect(component.getComplexSummary('hello')).toBe('hello');
		});
	});

	describe('onRowClick', () => {
		it('should emit entityClick and navigate', () => {
			const spy = vi.fn();
			component.entityClick.subscribe(spy);
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

			const entity = { id: 'e1', title: 'Test' } as TestEntity;
			component.onRowClick(entity);

			expect(spy).toHaveBeenCalledWith(entity);
			expect(routerSpy).toHaveBeenCalledWith(['/admin/collections/posts/e1']);
		});
	});

	describe('onRowAction', () => {
		it('should emit entityAction when action found', () => {
			const spy = vi.fn();
			component.entityAction.subscribe(spy);
			const actions: EntityAction[] = [{ id: 'edit', label: 'Edit' }];
			fixture.componentRef.setInput('rowActions', actions);

			const entity = { id: 'e1', title: 'Test' } as TestEntity;
			component.onRowAction({
				action: { id: 'edit', label: 'Edit' },
				item: entity,
			});

			expect(spy).toHaveBeenCalledWith({
				action: actions[0],
				entity,
			});
		});

		it('should not emit when action not found', () => {
			const spy = vi.fn();
			component.entityAction.subscribe(spy);
			fixture.componentRef.setInput('rowActions', []);

			component.onRowAction({
				action: { id: 'unknown', label: 'Unknown' },
				item: { id: 'e1', title: 'Test' } as TestEntity,
			});

			expect(spy).not.toHaveBeenCalled();
		});
	});

	describe('onBulkAction', () => {
		it('should emit bulkAction and clear selection', async () => {
			const spy = vi.fn();
			component.bulkAction.subscribe(spy);
			const entities = [
				{ id: 'e1', title: 'Test1' } as TestEntity,
				{ id: 'e2', title: 'Test2' } as TestEntity,
			];
			component.selectedEntities.set(entities);

			const action: EntityAction = { id: 'export', label: 'Export' };
			await component.onBulkAction(action);

			expect(spy).toHaveBeenCalledWith({ action, entities });
			expect(component.selectedEntities()).toEqual([]);
		});

		it('should confirm bulk delete', async () => {
			component.selectedEntities.set([{ id: 'e1', title: 'Test1' } as TestEntity]);

			const action: EntityAction = {
				id: 'delete',
				label: 'Delete',
				requiresConfirmation: true,
			};
			await component.onBulkAction(action);

			expect(mockFeedback.confirmBulkDelete).toHaveBeenCalledWith('Posts', 1);
		});

		it('should not emit when bulk delete not confirmed', async () => {
			mockFeedback.confirmBulkDelete.mockResolvedValue(false);
			const spy = vi.fn();
			component.bulkAction.subscribe(spy);
			component.selectedEntities.set([{ id: 'e1', title: 'Test1' } as TestEntity]);

			const action: EntityAction = {
				id: 'delete',
				label: 'Delete',
				requiresConfirmation: true,
			};
			await component.onBulkAction(action);

			expect(spy).not.toHaveBeenCalled();
		});
	});

	describe('onSearchChange', () => {
		it('should set searchQuery and reset page', () => {
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			component.currentPage.set(3);

			component.onSearchChange('hello');

			expect(component.searchQuery()).toBe('hello');
			expect(component.currentPage()).toBe(1);
			expect(routerSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: { search: 'hello' },
					queryParamsHandling: 'merge',
					replaceUrl: true,
				}),
			);
		});

		it('should set search to null when empty', () => {
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			component.onSearchChange('');
			expect(routerSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: { search: null },
				}),
			);
		});
	});

	describe('onPageChange', () => {
		it('should set currentPage', () => {
			component.onPageChange(5);
			expect(component.currentPage()).toBe(5);
		});
	});

	describe('onSortChange', () => {
		it('should set sort and reset page', () => {
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			component.currentPage.set(3);

			component.onSortChange({ field: 'title', direction: 'asc' });

			expect(component.sort()).toEqual({ field: 'title', direction: 'asc' });
			expect(component.currentPage()).toBe(1);
			expect(routerSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: { sort: 'title' },
				}),
			);
		});

		it('should set desc sort with dash prefix', () => {
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			component.onSortChange({ field: 'title', direction: 'desc' });

			expect(routerSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: { sort: '-title' },
				}),
			);
		});

		it('should clear sort param when undefined', () => {
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			component.onSortChange(undefined);

			expect(component.sort()).toBeUndefined();
			expect(routerSpy).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					queryParams: { sort: null },
				}),
			);
		});
	});

	describe('toggleTrashView', () => {
		it('should toggle viewingTrash and reset state', () => {
			component.selectedEntities.set([{ id: 'e1', title: 'T' } as TestEntity]);
			component.currentPage.set(3);

			component.toggleTrashView();

			expect(component.viewingTrash()).toBe(true);
			expect(component.currentPage()).toBe(1);
			expect(component.selectedEntities()).toEqual([]);
		});

		it('should toggle back', () => {
			component.viewingTrash.set(true);
			component.toggleTrashView();
			expect(component.viewingTrash()).toBe(false);
		});
	});

	describe('onCreateClick', () => {
		it('should navigate to create path', () => {
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			component.onCreateClick();
			expect(routerSpy).toHaveBeenCalledWith(['/admin/collections/posts/new']);
		});
	});

	describe('reload', () => {
		it('should not throw', () => {
			expect(() => component.reload()).not.toThrow();
		});
	});

	describe('openDataPreview', () => {
		it('should open dialog with group field data', () => {
			const value = { name: 'John' };
			component.openDataPreview(value, 'title');
			expect(mockDialog.open).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					data: expect.objectContaining({
						title: 'Title',
						value,
					}),
					width: '40rem',
				}),
			);
		});

		it('should use humanized name when field has no label', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [{ name: 'myField', type: 'text' } as Field],
			};
			fixture.componentRef.setInput('collection', col);

			component.openDataPreview('value', 'myField');
			expect(mockDialog.open).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					data: expect.objectContaining({
						title: 'My Field',
					}),
				}),
			);
		});
	});

	describe('initial state from URL params', () => {
		it('should initialize search from query params', async () => {
			TestBed.resetTestingModule();
			await TestBed.configureTestingModule({
				imports: [EntityListWidget],
				providers: [
					provideHttpClient(),
					provideHttpClientTesting(),
					provideRouter([]),
					{ provide: PLATFORM_ID, useValue: 'browser' },
					{ provide: CollectionAccessService, useValue: mockAccess },
					{ provide: FeedbackService, useValue: mockFeedback },
					{ provide: DialogService, useValue: mockDialog },
					{
						provide: ActivatedRoute,
						useValue: { snapshot: { queryParams: { search: 'hello' } } },
					},
				],
			})
				.overrideComponent(EntityListWidget, {
					set: { template: '<div></div>', imports: [] },
				})
				.compileComponents();

			const f = TestBed.createComponent(EntityListWidget<TestEntity>);
			f.componentRef.setInput('collection', testCollection);
			f.detectChanges();

			expect(f.componentInstance.searchQuery()).toBe('hello');
		});

		it('should initialize sort from query params', async () => {
			TestBed.resetTestingModule();
			await TestBed.configureTestingModule({
				imports: [EntityListWidget],
				providers: [
					provideHttpClient(),
					provideHttpClientTesting(),
					provideRouter([]),
					{ provide: PLATFORM_ID, useValue: 'browser' },
					{ provide: CollectionAccessService, useValue: mockAccess },
					{ provide: FeedbackService, useValue: mockFeedback },
					{ provide: DialogService, useValue: mockDialog },
					{
						provide: ActivatedRoute,
						useValue: { snapshot: { queryParams: { sort: '-title' } } },
					},
				],
			})
				.overrideComponent(EntityListWidget, {
					set: { template: '<div></div>', imports: [] },
				})
				.compileComponents();

			const f = TestBed.createComponent(EntityListWidget<TestEntity>);
			f.componentRef.setInput('collection', testCollection);
			f.detectChanges();

			expect(f.componentInstance.sort()).toEqual({
				field: 'title',
				direction: 'desc',
			});
		});

		it('should initialize asc sort from query params', async () => {
			TestBed.resetTestingModule();
			await TestBed.configureTestingModule({
				imports: [EntityListWidget],
				providers: [
					provideHttpClient(),
					provideHttpClientTesting(),
					provideRouter([]),
					{ provide: PLATFORM_ID, useValue: 'browser' },
					{ provide: CollectionAccessService, useValue: mockAccess },
					{ provide: FeedbackService, useValue: mockFeedback },
					{ provide: DialogService, useValue: mockDialog },
					{
						provide: ActivatedRoute,
						useValue: { snapshot: { queryParams: { sort: 'createdAt' } } },
					},
				],
			})
				.overrideComponent(EntityListWidget, {
					set: { template: '<div></div>', imports: [] },
				})
				.compileComponents();

			const f = TestBed.createComponent(EntityListWidget<TestEntity>);
			f.componentRef.setInput('collection', testCollection);
			f.detectChanges();

			expect(f.componentInstance.sort()).toEqual({
				field: 'createdAt',
				direction: 'asc',
			});
		});
	});

	describe('number displayFormat rendering', () => {
		it('should create render function for formatted numbers', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [
					{
						name: 'price',
						type: 'number',
						label: 'Price',
						displayFormat: {
							style: 'currency',
							currency: 'USD',
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						},
					} as unknown as Field,
				],
			};
			fixture.componentRef.setInput('collection', col);
			const columns = component.tableColumns();
			const priceCol = columns.find((c) => c.field === 'price');
			expect(priceCol?.render).toBeDefined();
			if (priceCol?.render) {
				const row = {} as TestEntity;
				expect(priceCol.render(null, row)).toBe('-');
				expect(priceCol.render(undefined, row)).toBe('-');
				expect(priceCol.render('abc', row)).toBe('abc');
				const formatted = priceCol.render(42.5, row);
				expect(formatted).toContain('42.50');
			}
		});
	});

	describe('date displayFormat rendering', () => {
		it('should create render function for formatted dates', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [
					{
						name: 'dueDate',
						type: 'date',
						label: 'Due Date',
						displayFormat: {
							preset: 'medium',
							includeTime: true,
							timePreset: 'short',
						},
					} as unknown as Field,
				],
			};
			fixture.componentRef.setInput('collection', col);
			const columns = component.tableColumns();
			const dateCol = columns.find((c) => c.field === 'dueDate');
			expect(dateCol?.render).toBeDefined();
			if (dateCol?.render) {
				const row = {} as TestEntity;
				expect(dateCol.render(null, row)).toBe('-');
				expect(dateCol.render(undefined, row)).toBe('-');
				expect(dateCol.render('not-a-date', row)).toBe('not-a-date');
				const formatted = dateCol.render('2024-06-15T10:30:00Z', row);
				expect(formatted.length).toBeGreaterThan(0);
			}
		});
	});

	describe('default render function (formatValue)', () => {
		it('should create render function for default text columns', () => {
			const columns = component.tableColumns();
			const titleCol = columns.find((c) => c.field === 'title');
			expect(titleCol?.render).toBeDefined();
			if (titleCol?.render) {
				const row = {} as TestEntity;
				expect(titleCol.render(null, row)).toBe('-');
				expect(titleCol.render('hello', row)).toBe('hello');
				expect(titleCol.render('a'.repeat(200), row)).toBe('a'.repeat(100) + '...');
			}
		});
	});

	describe('formatValue via render callbacks', () => {
		function getRender(fieldDef: Field): ((v: unknown, item: TestEntity) => string) | undefined {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [fieldDef],
			};
			fixture.componentRef.setInput('collection', col);
			const columns = component.tableColumns();
			return columns.find((c) => c.field === fieldDef.name)?.render;
		}

		const row = {} as TestEntity;

		it('should format boolean values', () => {
			const render = getRender({ name: 'active', type: 'checkbox', label: 'Active' } as Field);
			expect(render?.(true, row)).toBe('Yes');
			expect(render?.(false, row)).toBe('No');
		});

		it('should format array values', () => {
			const render = getRender({
				name: 'tags',
				type: 'array',
				label: 'Tags',
				fields: [],
			} as unknown as Field);
			expect(render?.([1, 2, 3], row)).toBe('3 items');
			expect(render?.([1], row)).toBe('1 item');
			expect(render?.(null, row)).toBe('-');
		});

		it('should format relationship values', () => {
			const render = getRender({
				name: 'author',
				type: 'relationship',
				label: 'Author',
				collection: () => testCollection,
			} as unknown as Field);
			expect(render?.({ id: '1', title: 'John' }, row)).toBe('John');
			expect(render?.({ id: '1', name: 'Jane' }, row)).toBe('Jane');
			expect(render?.({ id: '1' }, row)).toBe('1');
			expect(render?.('rel-id', row)).toBe('rel-id');
		});

		it('should format date values', () => {
			const render = getRender({ name: 'startDate', type: 'date', label: 'Start Date' } as Field);
			const result = render?.('2024-01-15', row);
			expect(result).toBeDefined();
			expect(result?.length).toBeGreaterThan(0);
		});
	});
});

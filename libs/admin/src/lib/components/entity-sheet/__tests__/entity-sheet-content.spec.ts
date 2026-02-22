import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { EntitySheetContentComponent } from '../entity-sheet-content.component';
import { EntitySheetService, SHEET_QUERY_PARAMS } from '../../../services/entity-sheet.service';

@Component({ selector: 'mcms-entity-form', template: '' })
class MockEntityForm {}

@Component({ selector: 'mcms-entity-view', template: '' })
class MockEntityView {}

const mockCollections = [
	{
		slug: 'posts',
		fields: [{ name: 'title', type: 'text' }],
		labels: { singular: 'Post', plural: 'Posts' },
	},
	{
		slug: 'authors',
		fields: [{ name: 'name', type: 'text' }],
		labels: { singular: 'Author', plural: 'Authors' },
	},
];

class MockEntitySheetService {
	close = vi.fn();
}

describe('EntitySheetContentComponent', () => {
	let fixture: ComponentFixture<EntitySheetContentComponent>;
	let component: EntitySheetContentComponent;
	let router: Router;
	let mockSheet: MockEntitySheetService;
	let queryParamSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

	function setup(
		queryParams: Record<string, string> = {},
		parentCollections = mockCollections,
	): void {
		mockSheet = new MockEntitySheetService();
		queryParamSubject = new BehaviorSubject(convertToParamMap(queryParams));

		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [EntitySheetContentComponent],
			providers: [
				provideRouter([]),
				{
					provide: ActivatedRoute,
					useValue: {
						queryParamMap: queryParamSubject.asObservable(),
						snapshot: {
							data: { collections: parentCollections },
						},
						parent: {
							snapshot: {
								data: { collections: parentCollections },
							},
							parent: null,
						},
					},
				},
				{ provide: EntitySheetService, useValue: mockSheet },
			],
		}).overrideComponent(EntitySheetContentComponent, {
			set: {
				imports: [MockEntityForm, MockEntityView],
				template: '<div></div>',
			},
		});

		fixture = TestBed.createComponent(EntitySheetContentComponent);
		component = fixture.componentInstance;
		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture.detectChanges();
	}

	beforeEach(() => {
		setup({
			[SHEET_QUERY_PARAMS.collection]: 'posts',
			[SHEET_QUERY_PARAMS.mode]: 'edit',
			[SHEET_QUERY_PARAMS.entityId]: 'doc-1',
		});
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('collectionSlug', () => {
		it('should resolve from query params', () => {
			expect(component.collectionSlug()).toBe('posts');
		});

		it('should be null when no query param', () => {
			setup({});
			expect(component.collectionSlug()).toBeNull();
		});
	});

	describe('entityId', () => {
		it('should resolve from query params', () => {
			expect(component.entityId()).toBe('doc-1');
		});

		it('should be undefined when no query param', () => {
			setup({ [SHEET_QUERY_PARAMS.collection]: 'posts' });
			expect(component.entityId()).toBeUndefined();
		});
	});

	describe('mode', () => {
		it('should resolve edit mode from query params', () => {
			expect(component.mode()).toBe('edit');
		});

		it('should resolve create mode from query params', () => {
			setup({ [SHEET_QUERY_PARAMS.collection]: 'posts', [SHEET_QUERY_PARAMS.mode]: 'create' });
			expect(component.mode()).toBe('create');
		});

		it('should resolve view mode from query params', () => {
			setup({
				[SHEET_QUERY_PARAMS.collection]: 'posts',
				[SHEET_QUERY_PARAMS.mode]: 'view',
				[SHEET_QUERY_PARAMS.entityId]: '1',
			});
			expect(component.mode()).toBe('view');
		});

		it('should default to view when entityId exists and mode is unknown', () => {
			setup({
				[SHEET_QUERY_PARAMS.collection]: 'posts',
				[SHEET_QUERY_PARAMS.entityId]: '1',
			});
			expect(component.mode()).toBe('view');
		});

		it('should default to create when no entityId and mode is unknown', () => {
			setup({ [SHEET_QUERY_PARAMS.collection]: 'posts' });
			expect(component.mode()).toBe('create');
		});
	});

	describe('formMode', () => {
		it('should return edit when mode is view', () => {
			setup({
				[SHEET_QUERY_PARAMS.collection]: 'posts',
				[SHEET_QUERY_PARAMS.mode]: 'view',
				[SHEET_QUERY_PARAMS.entityId]: '1',
			});
			expect(component.formMode()).toBe('edit');
		});

		it('should pass through edit mode', () => {
			expect(component.formMode()).toBe('edit');
		});

		it('should pass through create mode', () => {
			setup({ [SHEET_QUERY_PARAMS.collection]: 'posts', [SHEET_QUERY_PARAMS.mode]: 'create' });
			expect(component.formMode()).toBe('create');
		});
	});

	describe('collection', () => {
		it('should resolve collection from route data', () => {
			const col = component.collection();
			expect(col).toBeDefined();
			expect(col?.slug).toBe('posts');
		});

		it('should return null when no slug', () => {
			setup({});
			expect(component.collection()).toBeNull();
		});

		it('should return null when slug not found', () => {
			setup({ [SHEET_QUERY_PARAMS.collection]: 'nonexistent' });
			expect(component.collection()).toBeNull();
		});
	});

	describe('title', () => {
		it('should return "Edit Post" for edit mode', () => {
			expect(component.title()).toBe('Edit Post');
		});

		it('should return "Create Post" for create mode', () => {
			setup({ [SHEET_QUERY_PARAMS.collection]: 'posts', [SHEET_QUERY_PARAMS.mode]: 'create' });
			expect(component.title()).toBe('Create Post');
		});

		it('should return label for view mode', () => {
			setup({
				[SHEET_QUERY_PARAMS.collection]: 'posts',
				[SHEET_QUERY_PARAMS.mode]: 'view',
				[SHEET_QUERY_PARAMS.entityId]: '1',
			});
			expect(component.title()).toBe('Post');
		});

		it('should use "Entity" when collection not found', () => {
			setup({
				[SHEET_QUERY_PARAMS.collection]: 'nonexistent',
				[SHEET_QUERY_PARAMS.mode]: 'create',
			});
			expect(component.title()).toBe('Create Entity');
		});
	});

	describe('onSaved', () => {
		it('should close sheet with created action in create mode', () => {
			setup({ [SHEET_QUERY_PARAMS.collection]: 'posts', [SHEET_QUERY_PARAMS.mode]: 'create' });
			const entity = { id: 'new-1', title: 'New Post' };
			component.onSaved(entity);
			expect(mockSheet.close).toHaveBeenCalledWith({
				action: 'created',
				entity,
				collection: 'posts',
			});
		});

		it('should close sheet with updated action in edit mode', () => {
			const entity = { id: 'doc-1', title: 'Updated Post' };
			component.onSaved(entity);
			expect(mockSheet.close).toHaveBeenCalledWith({
				action: 'updated',
				entity,
				collection: 'posts',
			});
		});
	});

	describe('onDeleted', () => {
		it('should close sheet with deleted action', () => {
			const entity = { id: 'doc-1' };
			component.onDeleted(entity);
			expect(mockSheet.close).toHaveBeenCalledWith({
				action: 'deleted',
				entity,
				collection: 'posts',
			});
		});
	});

	describe('onClose', () => {
		it('should close sheet with cancelled action', () => {
			component.onClose();
			expect(mockSheet.close).toHaveBeenCalledWith({
				action: 'cancelled',
				collection: 'posts',
			});
		});
	});

	describe('onSwitchToEdit', () => {
		it('should update query param and set local mode override', () => {
			setup({
				[SHEET_QUERY_PARAMS.collection]: 'posts',
				[SHEET_QUERY_PARAMS.mode]: 'view',
				[SHEET_QUERY_PARAMS.entityId]: '1',
			});
			expect(component.mode()).toBe('view');

			component.onSwitchToEdit();

			expect(component.mode()).toBe('edit');
			expect(router.navigate).toHaveBeenCalledWith([], {
				queryParams: { [SHEET_QUERY_PARAMS.mode]: 'edit' },
				queryParamsHandling: 'merge',
			});
		});
	});
});

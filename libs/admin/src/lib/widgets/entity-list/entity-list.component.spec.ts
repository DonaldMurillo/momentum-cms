import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import type { CollectionConfig } from '@momentum-cms/core';
import { EntityListWidget } from './entity-list.component';
import { CollectionAccessService } from '../../services/collection-access.service';
import { FeedbackService } from '../feedback/feedback.service';

describe('EntityListWidget', () => {
	let fixture: ComponentFixture<EntityListWidget>;
	let component: EntityListWidget;
	let httpMock: HttpTestingController;
	let router: Router;
	let mockAccessService: Partial<CollectionAccessService>;
	let mockFeedbackService: Partial<FeedbackService>;

	const mockCollection: CollectionConfig = {
		slug: 'posts',
		fields: [
			{ name: 'title', type: 'text', label: 'Title' },
			{ name: 'content', type: 'textarea', label: 'Content' },
			{
				name: 'status',
				type: 'select',
				label: 'Status',
				options: [
					{ label: 'Draft', value: 'draft' },
					{ label: 'Published', value: 'published' },
				],
			},
			{ name: 'published', type: 'checkbox', label: 'Published' },
		],
		labels: { singular: 'Post', plural: 'Posts' },
		timestamps: true,
	};

	const mockPosts = [
		{
			id: '1',
			title: 'First Post',
			content: 'Content 1',
			status: 'published',
			published: true,
			createdAt: '2024-01-01T00:00:00Z',
		},
		{
			id: '2',
			title: 'Second Post',
			content: 'Content 2',
			status: 'draft',
			published: false,
			createdAt: '2024-01-02T00:00:00Z',
		},
	];

	beforeEach(async () => {
		mockAccessService = {
			canCreate: vi.fn().mockReturnValue(true),
			canRead: vi.fn().mockReturnValue(true),
			canUpdate: vi.fn().mockReturnValue(true),
			canDelete: vi.fn().mockReturnValue(true),
			loading: signal(false),
			initialized: signal(true),
		};

		mockFeedbackService = {
			entityDeleted: vi.fn(),
			entitiesDeleted: vi.fn(),
			operationFailed: vi.fn(),
			confirmDelete: vi.fn().mockResolvedValue(true),
			confirmBulkDelete: vi.fn().mockResolvedValue(true),
		};

		await TestBed.configureTestingModule({
			imports: [EntityListWidget],
			providers: [
				provideRouter([]),
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: CollectionAccessService, useValue: mockAccessService },
				{ provide: FeedbackService, useValue: mockFeedbackService },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EntityListWidget);
		component = fixture.componentInstance;
		httpMock = TestBed.inject(HttpTestingController);
		router = TestBed.inject(Router);
	});

	afterEach(() => {
		httpMock.verify();
	});

	/** Helper to set collection and flush the initial request */
	async function setCollectionAndFlush(collection = mockCollection): Promise<void> {
		fixture.componentRef.setInput('collection', collection);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes(`/api/${collection.slug}`));
		req.flush({ docs: mockPosts, totalDocs: 2, totalPages: 1, page: 1, limit: 10 });

		fixture.detectChanges();
		await fixture.whenStable();
	}

	it('should create', async () => {
		await setCollectionAndFlush();
		expect(component).toBeTruthy();
	});

	it('should fetch and display entities', async () => {
		await setCollectionAndFlush();

		expect(component.entities()).toHaveLength(2);
		expect(component.totalItems()).toBe(2);
		expect(component.loading()).toBe(false);
	});

	it('should auto-derive columns from collection fields', async () => {
		await setCollectionAndFlush();

		const columns = component.tableColumns();
		expect(columns.length).toBeGreaterThan(0);
		expect(columns.some((c) => c.field === 'title')).toBe(true);
	});

	it('should use custom columns when provided', async () => {
		const customColumns = [
			{ field: 'title', header: 'Custom Title' },
			{ field: 'status', header: 'Custom Status' },
		];

		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('columns', customColumns);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: mockPosts, totalDocs: 2 });

		expect(component.tableColumns()).toEqual(customColumns);
	});

	it('should show loading state', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();

		// Before responding to the request
		expect(component.loading()).toBe(true);

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: mockPosts, totalDocs: 2 });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.loading()).toBe(false);
	});

	it('should handle error when fetch fails', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond with error
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.error(new ErrorEvent('Network error'));

		// Wait for async error handling
		await new Promise((resolve) => setTimeout(resolve, 10));
		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.error()).toBe('Failed to load data');
		expect(component.entities()).toEqual([]);
	});

	it('should navigate to entity on row click', async () => {
		const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

		await setCollectionAndFlush();

		const entity = mockPosts[0];
		component.onRowClick(entity);

		expect(navigateSpy).toHaveBeenCalledWith(['/admin/collections/posts/1']);
	});

	it('should emit entityClick on row click', async () => {
		const entityClickSpy = vi.fn();
		component.entityClick.subscribe(entityClickSpy);

		await setCollectionAndFlush();

		const entity = mockPosts[0];
		component.onRowClick(entity);

		expect(entityClickSpy).toHaveBeenCalledWith(entity);
	});

	it('should use custom basePath', async () => {
		const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('basePath', '/dashboard/content');
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: mockPosts, totalDocs: 2 });

		fixture.detectChanges();
		await fixture.whenStable();

		const entity = mockPosts[0];
		component.onRowClick(entity);

		expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/content/posts/1']);
	});

	it('should emit entityAction when row action is triggered', async () => {
		const actions = [
			{ id: 'edit', label: 'Edit' },
			{ id: 'delete', label: 'Delete', variant: 'destructive' as const },
		];

		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('rowActions', actions);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: mockPosts, totalDocs: 2 });

		fixture.detectChanges();
		await fixture.whenStable();

		const entityActionSpy = vi.fn();
		component.entityAction.subscribe(entityActionSpy);

		component.onRowAction({ action: { id: 'edit', label: 'Edit' }, item: mockPosts[0] });

		expect(entityActionSpy).toHaveBeenCalledWith({
			action: { id: 'edit', label: 'Edit' },
			entity: mockPosts[0],
		});
	});

	it('should handle bulk delete with confirmation', async () => {
		const bulkActions = [
			{
				id: 'delete',
				label: 'Delete',
				variant: 'destructive' as const,
				requiresConfirmation: true,
			},
		];

		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('bulkActions', bulkActions);
		fixture.componentRef.setInput('selectable', true);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: mockPosts, totalDocs: 2 });

		fixture.detectChanges();
		await fixture.whenStable();

		// Select some entities
		component.selectedEntities.set([mockPosts[0], mockPosts[1]]);

		const bulkActionSpy = vi.fn();
		component.bulkAction.subscribe(bulkActionSpy);

		await component.onBulkAction(bulkActions[0]);

		expect(mockFeedbackService.confirmBulkDelete).toHaveBeenCalledWith('Posts', 2);
		expect(bulkActionSpy).toHaveBeenCalledWith({
			action: bulkActions[0],
			entities: mockPosts,
		});
	});

	it('should clear selection after bulk action', async () => {
		const bulkActions = [{ id: 'archive', label: 'Archive' }];

		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('bulkActions', bulkActions);
		fixture.componentRef.setInput('selectable', true);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: mockPosts, totalDocs: 2 });

		fixture.detectChanges();
		await fixture.whenStable();

		component.selectedEntities.set([mockPosts[0]]);
		await component.onBulkAction(bulkActions[0]);

		expect(component.selectedEntities()).toEqual([]);
	});

	it('should update current page on page change', async () => {
		await setCollectionAndFlush();

		expect(component.currentPage()).toBe(1);

		component.onPageChange(2);

		expect(component.currentPage()).toBe(2);
	});

	it('should reload data when search changes', async () => {
		await setCollectionAndFlush();

		component.onSearchChange('test');

		// Wait for effect to trigger
		fixture.detectChanges();

		// Should make another request with search
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		expect(component.searchQuery()).toBe('test');
		expect(component.currentPage()).toBe(1); // Reset to page 1
		req.flush({ docs: [], totalDocs: 0 });
	});

	it('should sync search to URL when search changes', async () => {
		await setCollectionAndFlush();

		const navigateSpy = vi.spyOn(router, 'navigate');

		component.onSearchChange('findme');

		// Wait for effect to trigger
		fixture.detectChanges();

		// Should update URL with search param
		expect(navigateSpy).toHaveBeenCalledWith([], {
			queryParams: { search: 'findme' },
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});

		// Flush the API request triggered by search
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: [], totalDocs: 0 });
	});

	it('should clear search URL param when search is empty', async () => {
		await setCollectionAndFlush();

		// First set a non-empty search
		component.onSearchChange('something');
		fixture.detectChanges();
		httpMock.expectOne((r) => r.url.includes('/api/posts')).flush({ docs: [], totalDocs: 0 });

		const navigateSpy = vi.spyOn(router, 'navigate');

		// Now clear the search
		component.onSearchChange('');
		fixture.detectChanges();

		// Should clear the search param (null removes from URL)
		expect(navigateSpy).toHaveBeenCalledWith([], {
			queryParams: { search: null },
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});

		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: [], totalDocs: 0 });
	});

	it('should compute collection labels correctly', async () => {
		await setCollectionAndFlush();

		expect(component.collectionLabel()).toBe('Posts');
		expect(component.collectionLabelSingular()).toBe('Post');
	});

	it('should use slug when no labels provided', async () => {
		const collectionNoLabels: CollectionConfig = {
			slug: 'items',
			fields: [{ name: 'name', type: 'text' }],
		};

		fixture.componentRef.setInput('collection', collectionNoLabels);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes('/api/items'));
		req.flush({ docs: [], totalDocs: 0 });

		expect(component.collectionLabel()).toBe('Items');
		expect(component.collectionLabelSingular()).toBe('Items');
	});

	it('should emit dataLoaded when data is fetched', async () => {
		const dataLoadedSpy = vi.fn();
		component.dataLoaded.subscribe(dataLoadedSpy);

		await setCollectionAndFlush();

		expect(dataLoadedSpy).toHaveBeenCalled();
		expect(dataLoadedSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				docs: mockPosts,
				totalDocs: 2,
			}),
		);
	});

	it('should track entities by id', async () => {
		await setCollectionAndFlush();

		const entity = { id: 'test-123' };
		expect(component.trackById(entity as never)).toBe('test-123');
	});

	it('should not cancel bulk action when confirmation is declined', async () => {
		(mockFeedbackService.confirmBulkDelete as ReturnType<typeof vi.fn>).mockResolvedValue(false);

		const bulkActions = [
			{
				id: 'delete',
				label: 'Delete',
				variant: 'destructive' as const,
				requiresConfirmation: true,
			},
		];

		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('bulkActions', bulkActions);
		fixture.componentRef.setInput('selectable', true);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
		req.flush({ docs: mockPosts, totalDocs: 2 });

		fixture.detectChanges();
		await fixture.whenStable();

		component.selectedEntities.set([mockPosts[0]]);

		const bulkActionSpy = vi.fn();
		component.bulkAction.subscribe(bulkActionSpy);

		await component.onBulkAction(bulkActions[0]);

		// Should not emit if confirmation was declined
		expect(bulkActionSpy).not.toHaveBeenCalled();
	});

	describe('URL search param initialization', () => {
		it('should initialize search from URL query params', async () => {
			// Reset TestBed with ActivatedRoute mock that has search param
			TestBed.resetTestingModule();

			const mockRoute = {
				snapshot: {
					queryParams: { search: 'initial-search' },
				},
				paramMap: of(convertToParamMap({ slug: 'posts' })),
			};

			await TestBed.configureTestingModule({
				imports: [EntityListWidget],
				providers: [
					provideRouter([]),
					provideHttpClient(),
					provideHttpClientTesting(),
					{ provide: CollectionAccessService, useValue: mockAccessService },
					{ provide: FeedbackService, useValue: mockFeedbackService },
					{ provide: ActivatedRoute, useValue: mockRoute },
				],
			}).compileComponents();

			const testFixture = TestBed.createComponent(EntityListWidget);
			const testComponent = testFixture.componentInstance;
			const testHttpMock = TestBed.inject(HttpTestingController);

			// Search should be initialized from URL
			expect(testComponent.searchQuery()).toBe('initial-search');

			// Set collection to trigger data load
			testFixture.componentRef.setInput('collection', mockCollection);
			testFixture.detectChanges();

			// Flush initial request
			const req = testHttpMock.expectOne((r) => r.url.includes('/api/posts'));
			req.flush({ docs: [], totalDocs: 0 });

			testHttpMock.verify();
		});
	});

	describe('Soft Delete / Trash View', () => {
		const softDeleteCollection: CollectionConfig = {
			slug: 'posts',
			fields: [
				{ name: 'title', type: 'text', label: 'Title' },
				{ name: 'content', type: 'textarea', label: 'Content' },
			],
			labels: { singular: 'Post', plural: 'Posts' },
			timestamps: true,
			softDelete: true,
		};

		async function setCollectionAndFlushSoftDelete(): Promise<void> {
			fixture.componentRef.setInput('collection', softDeleteCollection);
			fixture.detectChanges();
			await fixture.whenStable();

			const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
			req.flush({ docs: mockPosts, totalDocs: 2, totalPages: 1, page: 1, limit: 10 });

			fixture.detectChanges();
			await fixture.whenStable();
		}

		it('should set hasSoftDelete to true for soft-delete collections', async () => {
			await setCollectionAndFlushSoftDelete();
			expect(component.hasSoftDelete()).toBe(true);
		});

		it('should set hasSoftDelete to false for regular collections', async () => {
			await setCollectionAndFlush();
			expect(component.hasSoftDelete()).toBe(false);
		});

		it('should toggle viewingTrash signal', async () => {
			await setCollectionAndFlushSoftDelete();
			expect(component.viewingTrash()).toBe(false);

			component.toggleTrashView();
			fixture.detectChanges();
			await fixture.whenStable();
			expect(component.viewingTrash()).toBe(true);

			// Flush request triggered by viewingTrash change
			const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
			req.flush({ docs: [], totalDocs: 0, totalPages: 0, page: 1, limit: 10 });
			fixture.detectChanges();
			await fixture.whenStable();

			component.toggleTrashView();
			fixture.detectChanges();
			await fixture.whenStable();
			expect(component.viewingTrash()).toBe(false);

			// Flush request triggered by viewingTrash change back
			const req2 = httpMock.expectOne((r) => r.url.includes('/api/posts'));
			req2.flush({ docs: mockPosts, totalDocs: 2, totalPages: 1, page: 1, limit: 10 });
		});

		it('should reset page to 1 and clear selection on trash toggle', async () => {
			await setCollectionAndFlushSoftDelete();
			component.currentPage.set(3);
			component.selectedEntities.set([mockPosts[0]]);

			component.toggleTrashView();
			fixture.detectChanges();
			await fixture.whenStable();

			expect(component.currentPage()).toBe(1);
			expect(component.selectedEntities()).toEqual([]);

			// Flush request triggered by toggle
			const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should send onlyDeleted param when viewing trash', async () => {
			await setCollectionAndFlushSoftDelete();

			component.toggleTrashView();
			fixture.detectChanges();
			await fixture.whenStable();

			const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
			expect(req.request.params.get('onlyDeleted')).toBe('true');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should add deletedAt column when viewing trash', async () => {
			await setCollectionAndFlushSoftDelete();

			component.toggleTrashView();
			fixture.detectChanges();
			await fixture.whenStable();

			const columns = component.tableColumns();
			const deletedAtCol = columns.find((c) => c.field === 'deletedAt');
			expect(deletedAtCol).toBeTruthy();
			expect(deletedAtCol!.header).toBe('Deleted');
			expect(deletedAtCol!.type).toBe('datetime');

			// Flush request triggered by toggle
			const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should not show createdAt column in trash view', async () => {
			await setCollectionAndFlushSoftDelete();

			component.toggleTrashView();
			fixture.detectChanges();
			await fixture.whenStable();

			const columns = component.tableColumns();
			const createdAtCol = columns.find((c) => c.field === 'createdAt');
			expect(createdAtCol).toBeUndefined();

			// Flush request triggered by toggle
			const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should show "Trash" as header title when viewing trash', async () => {
			await setCollectionAndFlushSoftDelete();
			fixture.componentRef.setInput('showHeader', true);

			component.toggleTrashView();
			fixture.detectChanges();
			await fixture.whenStable();

			const heading = fixture.nativeElement.querySelector('h1');
			expect(heading?.textContent?.trim()).toBe('Trash');

			// Flush request triggered by toggle
			const req = httpMock.expectOne((r) => r.url.includes('/api/posts'));
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should show View Trash button for soft-delete collections', async () => {
			fixture.componentRef.setInput('showHeader', true);
			await setCollectionAndFlushSoftDelete();
			fixture.detectChanges();

			const buttons = fixture.nativeElement.querySelectorAll('button');
			const trashBtn = Array.from<Element>(buttons).find(
				(btn) => btn.textContent?.trim() === 'View Trash',
			);
			expect(trashBtn).toBeTruthy();
		});

		it('should not show View Trash button for regular collections', async () => {
			fixture.componentRef.setInput('showHeader', true);
			await setCollectionAndFlush();
			fixture.detectChanges();

			const buttons = fixture.nativeElement.querySelectorAll('button');
			const trashBtn = Array.from<Element>(buttons).find(
				(btn) => btn.textContent?.trim() === 'View Trash',
			);
			expect(trashBtn).toBeUndefined();
		});
	});
});

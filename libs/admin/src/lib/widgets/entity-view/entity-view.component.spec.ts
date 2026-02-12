import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { CollectionConfig } from '@momentum-cms/core';
import { EntityViewWidget } from './entity-view.component';
import { CollectionAccessService } from '../../services/collection-access.service';
import { FeedbackService } from '../feedback/feedback.service';

describe('EntityViewWidget', () => {
	let fixture: ComponentFixture<EntityViewWidget>;
	let component: EntityViewWidget;
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
			{ name: 'featured', type: 'checkbox', label: 'Featured' },
		],
		labels: { singular: 'Post', plural: 'Posts' },
		timestamps: true,
	};

	const mockEntity = {
		id: '123',
		title: 'Test Post',
		content: 'Test content',
		status: 'draft',
		featured: false,
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-02T00:00:00Z',
	};

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
			entityNotFound: vi.fn(),
			operationFailed: vi.fn(),
			confirmDelete: vi.fn().mockResolvedValue(true),
		};

		await TestBed.configureTestingModule({
			imports: [EntityViewWidget],
			providers: [
				provideRouter([]),
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: CollectionAccessService, useValue: mockAccessService },
				{ provide: FeedbackService, useValue: mockFeedbackService },
			],
		}).compileComponents();

		httpMock = TestBed.inject(HttpTestingController);
		router = TestBed.inject(Router);
	});

	afterEach(() => {
		httpMock.match(() => true);
	});

	function createFixture(
		options: { collection?: CollectionConfig; entityId?: string; basePath?: string } = {},
	): void {
		fixture = TestBed.createComponent(EntityViewWidget);
		component = fixture.componentInstance;

		fixture.componentRef.setInput('collection', options.collection ?? mockCollection);
		fixture.componentRef.setInput('entityId', options.entityId ?? '123');
		if (options.basePath) {
			fixture.componentRef.setInput('basePath', options.basePath);
		}
	}

	describe('Loading', () => {
		it('should create', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component).toBeTruthy();
		});

		it('should load entity on init', async () => {
			createFixture({ entityId: '123' });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			expect(req.request.method).toBe('GET');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.entity()).toEqual(mockEntity);
		});

		it('should show loading state', async () => {
			createFixture();
			fixture.detectChanges();

			expect(component.isLoading()).toBe(true);

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.isLoading()).toBe(false);
		});

		it('should handle entity not found', async () => {
			createFixture({ entityId: '999' });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/999');
			req.flush({ doc: null });

			await fixture.whenStable();

			expect(mockFeedbackService.entityNotFound).toHaveBeenCalledWith('Post');
			expect(component.loadError()).toBeTruthy();
		});

		it('should handle load error', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

			await fixture.whenStable();

			expect(mockFeedbackService.operationFailed).toHaveBeenCalled();
			expect(component.loadError()).toBeTruthy();
		});
	});

	describe('Display', () => {
		it('should show entity title', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();
			fixture.detectChanges();

			expect(component.entityTitle()).toBe('Test Post');
		});

		it('should use ID if no title field', async () => {
			const entityNoTitle = { id: '456', status: 'draft' };

			createFixture({ entityId: '456' });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/456');
			req.flush({ doc: entityNoTitle });

			await fixture.whenStable();

			expect(component.entityTitle()).toBe('Post 456');
		});

		it('should show visible fields', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			const fields = component.visibleFields();
			expect(fields).toHaveLength(4);
			expect(fields.map((f) => f.name)).toEqual(['title', 'content', 'status', 'featured']);
		});

		it('should hide fields marked as hidden', async () => {
			const collectionWithHiddenField: CollectionConfig = {
				...mockCollection,
				fields: [
					{ name: 'title', type: 'text', label: 'Title' },
					{ name: 'secret', type: 'text', label: 'Secret', admin: { hidden: true } },
				],
			};

			createFixture({ collection: collectionWithHiddenField });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			const fields = component.visibleFields();
			expect(fields.map((f) => f.name)).not.toContain('secret');
		});

		it('should show timestamps if collection has them', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.hasTimestamps()).toBe(true);
		});

		it('should not show timestamps if collection does not have them', async () => {
			const collectionNoTimestamps: CollectionConfig = {
				...mockCollection,
				timestamps: undefined,
			};

			createFixture({ collection: collectionNoTimestamps });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.hasTimestamps()).toBe(false);
		});
	});

	describe('Field types', () => {
		it('should map text field to text display type', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			const titleField = mockCollection.fields.find((f) => f.name === 'title');
			expect(titleField).toBeDefined();
			if (titleField) {
				expect(component.getFieldDisplayType(titleField)).toBe('text');
			}
		});

		it('should map checkbox field to boolean display type', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			const featuredField = mockCollection.fields.find((f) => f.name === 'featured');
			expect(featuredField).toBeDefined();
			if (featuredField) {
				expect(component.getFieldDisplayType(featuredField)).toBe('boolean');
			}
		});

		it('should map select field to badge display type', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			const statusField = mockCollection.fields.find((f) => f.name === 'status');
			expect(statusField).toBeDefined();
			if (statusField) {
				expect(component.getFieldDisplayType(statusField)).toBe('badge');
			}
		});
	});

	describe('Permissions', () => {
		it('should show edit button when user can edit', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();
			fixture.detectChanges();

			expect(component.canEdit()).toBe(true);
		});

		it('should hide edit button when user cannot edit', async () => {
			(mockAccessService.canUpdate as ReturnType<typeof vi.fn>).mockReturnValue(false);

			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();
			fixture.detectChanges();

			expect(component.canEdit()).toBe(false);
		});

		it('should show delete button when user can delete', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.canDelete()).toBe(true);
		});

		it('should hide delete button when user cannot delete', async () => {
			(mockAccessService.canDelete as ReturnType<typeof vi.fn>).mockReturnValue(false);

			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.canDelete()).toBe(false);
		});
	});

	describe('Actions', () => {
		it('should navigate to edit page on edit click', async () => {
			const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			component.onEditClick();

			expect(navigateSpy).toHaveBeenCalledWith(['/admin/collections/posts/123/edit']);
		});

		it('should emit edit event on edit click', async () => {
			vi.spyOn(router, 'navigate').mockResolvedValue(true);
			const editSpy = vi.fn();

			createFixture();
			component.edit.subscribe(editSpy);
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			component.onEditClick();

			expect(editSpy).toHaveBeenCalledWith(mockEntity);
		});

		it('should delete entity and navigate back', async () => {
			const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			const deleteSpy = vi.fn();

			createFixture();
			component.delete_.subscribe(deleteSpy);
			fixture.detectChanges();

			const getReq = httpMock.expectOne((r) => r.url === '/api/posts/123');
			getReq.flush({ doc: mockEntity });

			await fixture.whenStable();

			// Start delete operation (confirmDelete is async)
			const deletePromise = component.onDeleteClick();

			// Allow confirmDelete promise to resolve before HTTP request is made
			await Promise.resolve();

			const deleteReq = httpMock.expectOne((r) => r.url === '/api/posts/123');
			expect(deleteReq.request.method).toBe('DELETE');
			deleteReq.flush({});

			await deletePromise;

			expect(deleteSpy).toHaveBeenCalledWith(mockEntity);
			expect(navigateSpy).toHaveBeenCalledWith(['/admin/collections/posts']);
		});

		it('should emit action event on custom action click', async () => {
			const actionSpy = vi.fn();

			fixture = TestBed.createComponent(EntityViewWidget);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('collection', mockCollection);
			fixture.componentRef.setInput('entityId', '123');
			fixture.componentRef.setInput('actions', [{ id: 'archive', label: 'Archive' }]);
			component.actionClick.subscribe(actionSpy);

			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			component.onActionClick({ id: 'archive', label: 'Archive' });

			expect(actionSpy).toHaveBeenCalledWith({
				action: expect.objectContaining({ id: 'archive' }),
				entity: mockEntity,
			});
		});
	});

	describe('Navigation', () => {
		it('should navigate back to list', async () => {
			const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			component.navigateBack();

			expect(navigateSpy).toHaveBeenCalledWith(['/admin/collections/posts']);
		});

		it('should use custom basePath', async () => {
			const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

			createFixture({ basePath: '/dashboard/content' });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			component.navigateBack();

			expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/content/posts']);
		});

		it('should compute correct paths for breadcrumbs', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.dashboardPath()).toBe('/admin');
			expect(component.collectionListPath()).toBe('/admin/collections/posts');
		});
	});

	describe('Collection labels', () => {
		it('should compute collection labels correctly', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.collectionLabel()).toBe('Posts');
			expect(component.collectionLabelSingular()).toBe('Post');
		});

		it('should use slug when no labels provided', async () => {
			const collectionNoLabels: CollectionConfig = {
				slug: 'items',
				fields: [{ name: 'name', type: 'text' }],
			};

			createFixture({ collection: collectionNoLabels });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/items/123');
			req.flush({ doc: { id: '123', name: 'Test' } });

			await fixture.whenStable();

			expect(component.collectionLabel()).toBe('Items');
			expect(component.collectionLabelSingular()).toBe('Items');
		});
	});

	describe('Soft Delete', () => {
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

		const deletedEntity = {
			id: '123',
			title: 'Deleted Post',
			content: 'Deleted content',
			deletedAt: '2024-06-01T12:00:00Z',
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-06-01T12:00:00Z',
		};

		it('should set hasSoftDelete to true for soft-delete collections', async () => {
			createFixture({ collection: softDeleteCollection });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });
			await fixture.whenStable();

			expect(component.hasSoftDelete()).toBe(true);
		});

		it('should set hasSoftDelete to false for regular collections', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });
			await fixture.whenStable();

			expect(component.hasSoftDelete()).toBe(false);
		});

		it('should detect soft-deleted entity via isDeleted signal', async () => {
			createFixture({ collection: softDeleteCollection });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: deletedEntity });
			await fixture.whenStable();

			expect(component.isDeleted()).toBe(true);
		});

		it('should not flag active entity as deleted', async () => {
			createFixture({ collection: softDeleteCollection });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });
			await fixture.whenStable();

			expect(component.isDeleted()).toBe(false);
		});

		it('should pass withDeleted query param when collection has softDelete', async () => {
			createFixture({ collection: softDeleteCollection });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			expect(req.request.params.get('withDeleted')).toBe('true');
			req.flush({ doc: deletedEntity });
			await fixture.whenStable();
		});

		it('should not pass withDeleted when collection has no softDelete', async () => {
			createFixture();
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			expect(req.request.params.has('withDeleted')).toBe(false);
			req.flush({ doc: mockEntity });
			await fixture.whenStable();
		});

		it('should render soft-deleted banner when entity is deleted', async () => {
			createFixture({ collection: softDeleteCollection });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: deletedEntity });
			await fixture.whenStable();
			fixture.detectChanges();

			const banner = fixture.nativeElement.querySelector('mcms-alert');
			expect(banner).toBeTruthy();
			expect(banner.textContent).toContain('deleted');
		});

		it('should show Restore button for deleted entities when user can edit', async () => {
			createFixture({ collection: softDeleteCollection });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: deletedEntity });
			await fixture.whenStable();
			fixture.detectChanges();

			const buttons = fixture.nativeElement.querySelectorAll('button');
			const restoreBtn = Array.from<Element>(buttons).find(
				(btn) => btn.textContent?.trim() === 'Restore',
			);
			expect(restoreBtn).toBeTruthy();
		});

		it('should show Permanently Delete button for deleted entities', async () => {
			createFixture({ collection: softDeleteCollection });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: deletedEntity });
			await fixture.whenStable();
			fixture.detectChanges();

			const buttons = fixture.nativeElement.querySelectorAll('button');
			const forceDeleteBtn = Array.from<Element>(buttons).find(
				(btn) => btn.textContent?.trim() === 'Permanently Delete',
			);
			expect(forceDeleteBtn).toBeTruthy();
		});

		it('should show "Move to Trash" instead of "Delete" for active soft-delete entities', async () => {
			createFixture({ collection: softDeleteCollection });
			fixture.detectChanges();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/123');
			req.flush({ doc: mockEntity });
			await fixture.whenStable();
			fixture.detectChanges();

			const buttons = fixture.nativeElement.querySelectorAll('button');
			const trashBtn = Array.from<Element>(buttons).find(
				(btn) => btn.textContent?.trim() === 'Move to Trash',
			);
			expect(trashBtn).toBeTruthy();
		});
	});
});

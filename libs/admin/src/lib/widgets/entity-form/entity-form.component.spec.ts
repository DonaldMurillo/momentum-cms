import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { CollectionConfig } from '@momentum-cms/core';
import { EntityFormWidget } from './entity-form.component';
import { CollectionAccessService } from '../../services/collection-access.service';
import { FeedbackService } from '../feedback/feedback.service';

describe('EntityFormWidget', () => {
	let fixture: ComponentFixture<EntityFormWidget>;
	let component: EntityFormWidget;
	let httpMock: HttpTestingController;
	let router: Router;
	let mockAccessService: Partial<CollectionAccessService>;
	let mockFeedbackService: Partial<FeedbackService>;

	const mockCollection: CollectionConfig = {
		slug: 'posts',
		fields: [
			{ name: 'title', type: 'text', label: 'Title', required: true },
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
	};

	const mockEntity = {
		id: '123',
		title: 'Test Post',
		content: 'Test content',
		status: 'draft',
		featured: false,
		createdAt: '2024-01-01T00:00:00Z',
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
			entityCreated: vi.fn(),
			entityUpdated: vi.fn(),
			entityNotFound: vi.fn(),
			operationFailed: vi.fn(),
		};

		await TestBed.configureTestingModule({
			imports: [EntityFormWidget],
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
		// Discard any pending requests to avoid verify errors
		httpMock.match(() => true);
	});

	function createFixture(
		options: {
			collection?: CollectionConfig;
			entityId?: string;
			mode?: 'create' | 'edit' | 'view';
			basePath?: string;
		} = {},
	): void {
		fixture = TestBed.createComponent(EntityFormWidget);
		component = fixture.componentInstance;

		fixture.componentRef.setInput('collection', options.collection ?? mockCollection);
		if (options.entityId !== undefined) {
			fixture.componentRef.setInput('entityId', options.entityId);
		}
		fixture.componentRef.setInput('mode', options.mode ?? 'create');
		if (options.basePath) {
			fixture.componentRef.setInput('basePath', options.basePath);
		}
	}

	describe('Create mode', () => {
		it('should create', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			expect(component).toBeTruthy();
		});

		it('should initialize with empty form data', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			const data = component.formData();
			expect(data['title']).toBe('');
			expect(data['content']).toBe('');
			expect(data['status']).toBeNull();
			expect(data['featured']).toBe(false);
		});

		it('should render visible fields', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			const fields = component.visibleFields();
			expect(fields).toHaveLength(4);
			expect(fields.map((f) => f.name)).toEqual(['title', 'content', 'status', 'featured']);
		});

		it('should show Create title', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			const header = fixture.nativeElement.querySelector('h1');
			expect(header.textContent).toContain('Create Post');
		});

		it('should disable submit when required fields are empty', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			expect(component.canSubmit()).toBe(false);
		});

		it('should enable submit when required fields have values', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			component.onFieldChange({ path: 'title', value: 'New Title' });
			fixture.detectChanges();
			expect(component.canSubmit()).toBe(true);
		});

		it('should create entity on submit', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			const savedSpy = vi.fn();
			component.saved.subscribe(savedSpy);

			component.onFieldChange({ path: 'title', value: 'New Post' });
			fixture.detectChanges();

			// Start submit and immediately flush the HTTP request
			const submitPromise = component.onSubmit();

			const req = httpMock.expectOne('/api/posts');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual(expect.objectContaining({ title: 'New Post' }));
			req.flush({ doc: { id: 'new-123', title: 'New Post' } });

			await submitPromise;

			expect(mockFeedbackService.entityCreated).toHaveBeenCalledWith('Post');
			expect(savedSpy).toHaveBeenCalled();
			expect(navigateSpy).toHaveBeenCalledWith(['/admin/collections/posts']);
		});

		it('should handle submit error', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			const errorSpy = vi.fn();
			component.saveError.subscribe(errorSpy);

			component.onFieldChange({ path: 'title', value: 'New Post' });
			fixture.detectChanges();

			const submitPromise = component.onSubmit();

			const req = httpMock.expectOne('/api/posts');
			req.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

			await submitPromise;

			expect(mockFeedbackService.operationFailed).toHaveBeenCalled();
			expect(component.formError()).toBeTruthy();
		});
	});

	describe('Edit mode', () => {
		it('should load entity for edit mode', async () => {
			createFixture({ entityId: '123', mode: 'edit' });
			fixture.detectChanges();

			const req = httpMock.expectOne('/api/posts/123');
			expect(req.request.method).toBe('GET');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();

			expect(component.formData()['title']).toBe('Test Post');
			expect(component.formData()['content']).toBe('Test content');
		});

		it('should show Edit title', async () => {
			createFixture({ entityId: '123', mode: 'edit' });
			fixture.detectChanges();

			const req = httpMock.expectOne('/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();
			fixture.detectChanges();

			const header = fixture.nativeElement.querySelector('h1');
			expect(header.textContent).toContain('Edit Post');
		});

		it('should update entity on submit', async () => {
			createFixture({ entityId: '123', mode: 'edit' });
			fixture.detectChanges();

			const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

			const getReq = httpMock.expectOne('/api/posts/123');
			getReq.flush({ doc: mockEntity });

			await fixture.whenStable();

			component.onFieldChange({ path: 'title', value: 'Updated Title' });
			fixture.detectChanges();

			const submitPromise = component.onSubmit();

			const updateReq = httpMock.expectOne('/api/posts/123');
			expect(updateReq.request.method).toBe('PATCH');
			expect(updateReq.request.body).toEqual(expect.objectContaining({ title: 'Updated Title' }));
			updateReq.flush({ doc: { ...mockEntity, title: 'Updated Title' } });

			await submitPromise;

			expect(mockFeedbackService.entityUpdated).toHaveBeenCalledWith('Post');
			expect(navigateSpy).toHaveBeenCalledWith(['/admin/collections/posts']);
		});

		it('should handle entity not found', async () => {
			createFixture({ entityId: '999', mode: 'edit' });
			fixture.detectChanges();

			const req = httpMock.expectOne('/api/posts/999');
			req.flush({ doc: null });

			await fixture.whenStable();

			expect(mockFeedbackService.entityNotFound).toHaveBeenCalledWith('Post');
		});
	});

	describe('View mode', () => {
		it('should not show Save/Cancel buttons in view mode', async () => {
			createFixture({ entityId: '123', mode: 'view' });
			fixture.detectChanges();

			const req = httpMock.expectOne('/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();
			fixture.detectChanges();

			const buttons = fixture.nativeElement.querySelectorAll('button');
			const buttonTexts = Array.from(buttons).map((b) =>
				(b as HTMLButtonElement).textContent?.trim(),
			);
			expect(buttonTexts).not.toContain('Save');
			expect(buttonTexts).not.toContain('Cancel');
		});

		it('should show Edit button when user can edit', async () => {
			createFixture({ entityId: '123', mode: 'view' });
			fixture.detectChanges();

			const req = httpMock.expectOne('/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();
			fixture.detectChanges();

			const buttons = fixture.nativeElement.querySelectorAll('button');
			const editButton = Array.from(buttons).find((b) =>
				(b as HTMLButtonElement).textContent?.includes('Edit'),
			);
			expect(editButton).toBeTruthy();
		});

		it('should emit modeChange when Edit is clicked', async () => {
			createFixture({ entityId: '123', mode: 'view' });
			fixture.detectChanges();

			const req = httpMock.expectOne('/api/posts/123');
			req.flush({ doc: mockEntity });

			await fixture.whenStable();
			fixture.detectChanges();

			const modeChangeSpy = vi.fn();
			component.modeChange.subscribe(modeChangeSpy);

			component.switchToEdit();

			expect(modeChangeSpy).toHaveBeenCalledWith('edit');
		});
	});

	describe('Navigation', () => {
		it('should navigate back on cancel', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
			const cancelledSpy = vi.fn();
			component.cancelled.subscribe(cancelledSpy);

			component.onCancel();

			expect(cancelledSpy).toHaveBeenCalled();
			expect(navigateSpy).toHaveBeenCalledWith(['/admin/collections/posts']);
		});

		it('should use custom basePath', async () => {
			createFixture({ mode: 'create', basePath: '/dashboard/content' });
			fixture.detectChanges();
			await fixture.whenStable();

			const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

			component.onCancel();

			expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/content/posts']);
		});
	});

	describe('Field changes', () => {
		it('should update form data on field change', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			component.onFieldChange({ path: 'title', value: 'New Title' });
			expect(component.formData()['title']).toBe('New Title');
		});

		it('should clear field error on change', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			component['errors'].set([{ field: 'title', message: 'Required' }]);
			expect(component.getFieldError('title')).toBe('Required');

			component.onFieldChange({ path: 'title', value: 'New Title' });

			expect(component.getFieldError('title')).toBeUndefined();
		});

		it('should get field value correctly', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			component.onFieldChange({ path: 'content', value: 'Some content' });
			expect(component.getFieldValue('content')).toBe('Some content');
		});
	});

	describe('Collection labels', () => {
		it('should compute collection labels correctly', async () => {
			createFixture({ mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			expect(component.collectionLabel()).toBe('Posts');
			expect(component.collectionLabelSingular()).toBe('Post');
		});

		it('should use slug when no labels provided', async () => {
			const collectionNoLabels: CollectionConfig = {
				slug: 'items',
				fields: [{ name: 'name', type: 'text' }],
			};

			createFixture({ collection: collectionNoLabels, mode: 'create' });
			fixture.detectChanges();
			await fixture.whenStable();

			expect(component.collectionLabel()).toBe('items');
			expect(component.collectionLabelSingular()).toBe('items');
		});
	});
});

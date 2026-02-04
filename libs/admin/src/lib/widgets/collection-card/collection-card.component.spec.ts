import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { CollectionConfig } from '@momentum-cms/core';
import { CollectionCardWidget } from './collection-card.component';
import { CollectionAccessService } from '../../services/collection-access.service';

describe('CollectionCardWidget', () => {
	let fixture: ComponentFixture<CollectionCardWidget>;
	let component: CollectionCardWidget;
	let httpMock: HttpTestingController;
	let mockAccessService: Partial<CollectionAccessService>;

	const mockCollection: CollectionConfig = {
		slug: 'posts',
		fields: [],
		labels: { singular: 'Post', plural: 'Posts' },
		admin: { description: 'Manage blog posts' },
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

		await TestBed.configureTestingModule({
			imports: [CollectionCardWidget],
			providers: [
				provideRouter([]),
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: CollectionAccessService, useValue: mockAccessService },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(CollectionCardWidget);
		component = fixture.componentInstance;
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	/** Helper to flush pending API requests */
	function flushPendingRequests(): void {
		const reqs = httpMock.match(() => true);
		reqs.forEach((req) => req.flush({ docs: [], totalDocs: 0 }));
	}

	it('should create', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		expect(component).toBeTruthy();
	});

	it('should render collection label', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const title = fixture.nativeElement.querySelector('h3');
		expect(title.textContent).toContain('Posts');
	});

	it('should render collection description', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Manage blog posts');
	});

	it('should fetch and display document count', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond to the HTTP request
		const req = httpMock.expectOne('/api/posts?limit=0');
		expect(req.request.method).toBe('GET');
		req.flush({ docs: [], totalDocs: 42 });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.count()).toBe(42);
	});

	it('should show skeleton while loading', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();

		// Don't respond to request yet - it's still loading
		const skeleton = fixture.nativeElement.querySelector('mcms-skeleton');
		expect(skeleton).toBeTruthy();

		// Clean up by responding to the pending request
		const req = httpMock.expectOne('/api/posts?limit=0');
		req.flush({ docs: [], totalDocs: 0 });
	});

	it('should show error badge when fetch fails', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();

		// Respond with error
		const req = httpMock.expectOne('/api/posts?limit=0');
		req.error(new ErrorEvent('Network error'));

		// Wait for async error handling and multiple change detection cycles
		await new Promise((resolve) => setTimeout(resolve, 10));
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(component.error()).toBe('Failed to load count');
		expect(component.loading()).toBe(false);
		const badge = fixture.nativeElement.querySelector('mcms-badge');
		expect(badge).toBeTruthy();
		expect(badge.textContent).toContain('Error');
	});

	it('should render view all link', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const viewPath = component.viewPath();
		expect(viewPath).toBe('/admin/collections/posts');
	});

	it('should render create button when user can create', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Create');
	});

	it('should not render create button when user cannot create', async () => {
		(mockAccessService.canCreate as ReturnType<typeof vi.fn>).mockReturnValue(false);

		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const links = fixture.nativeElement.querySelectorAll('a[mcms-button]');
		const createLink = Array.from(links).find((link) =>
			(link as HTMLElement).textContent?.includes('Create'),
		);
		expect(createLink).toBeFalsy();
	});

	it('should use custom basePath', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('basePath', '/dashboard/content');
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		expect(component.viewPath()).toBe('/dashboard/content/posts');
		expect(component.createPath()).toBe('/dashboard/content/posts/new');
	});

	it('should use slug when no labels provided', async () => {
		const collectionNoLabel: CollectionConfig = { slug: 'items', fields: [] };
		fixture.componentRef.setInput('collection', collectionNoLabel);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		expect(component.collectionLabel()).toBe('items');
	});

	it('should show default description when none provided', async () => {
		const collectionNoDesc: CollectionConfig = {
			slug: 'items',
			fields: [],
			labels: { plural: 'Items' },
		};
		fixture.componentRef.setInput('collection', collectionNoDesc);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Manage items');
	});

	it('should not fetch count when showDocumentCount is false', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('showDocumentCount', false);
		fixture.detectChanges();
		await fixture.whenStable();

		// No HTTP requests should be made
		httpMock.expectNone('/api/posts?limit=0');
	});
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { CollectionConfig } from '@momentumcms/core';
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

	it('should render collection label as the row title', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		// Row layout: the title is the first anchor's text, not a heading element.
		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Posts');
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

		const req = httpMock.expectOne('/api/posts?limit=0');
		expect(req.request.method).toBe('GET');
		req.flush({ docs: [], totalDocs: 42 });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.count()).toBe(42);
	});

	it('should render an em-dash placeholder while count is loading', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();

		// Pair the user-visible "—" with the loading() signal so a future swap
		// (e.g. spinner instead of dash) still has to keep loading state correct.
		expect(component.loading()).toBe(true);
		const text = fixture.nativeElement.textContent;
		expect(text).toContain('—');

		// Clean up the pending request.
		const req = httpMock.expectOne('/api/posts?limit=0');
		req.flush({ docs: [], totalDocs: 0 });
	});

	it('should render a destructive indicator when fetch fails', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();

		const req = httpMock.expectOne('/api/posts?limit=0');
		req.error(new ErrorEvent('Network error'));

		// Wait for async error handling.
		await new Promise((resolve) => setTimeout(resolve, 10));
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		// Verify both the internal signal AND the user-visible error UI element —
		// the destructive-tinted exclamation that replaces the count.
		expect(component.error()).toBe('Failed to load count');
		expect(component.loading()).toBe(false);
		const errorIndicator = fixture.nativeElement.querySelector('.text-destructive');
		expect(errorIndicator).toBeTruthy();
	});

	it('should render view all link', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const viewPath = component.viewPath();
		expect(viewPath).toBe('/admin/collections/posts');
	});

	it('should render the "New" action when user can create', async () => {
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('New');
	});

	it('should not render the "New" action when user cannot create', async () => {
		(mockAccessService.canCreate as ReturnType<typeof vi.fn>).mockReturnValue(false);

		fixture.componentRef.setInput('collection', mockCollection);
		fixture.detectChanges();
		await fixture.whenStable();
		flushPendingRequests();

		const links = Array.from(
			fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
		);
		const createLink = links.find((link) => link.textContent?.trim() === 'New');
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

		expect(component.collectionLabel()).toBe('Items');
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

		httpMock.expectNone('/api/posts?limit=0');
	});
});

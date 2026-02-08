import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient, HttpContext } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FeedbackService } from '../widgets/feedback/feedback.service';
import { crudToastInterceptor, SKIP_AUTO_TOAST } from './crud-toast.interceptor';

describe('crudToastInterceptor', () => {
	let http: HttpClient;
	let httpMock: HttpTestingController;
	let feedback: Partial<Record<keyof FeedbackService, ReturnType<typeof vi.fn>>>;

	beforeEach(() => {
		feedback = {
			entityCreated: vi.fn(),
			entityUpdated: vi.fn(),
			entityDeleted: vi.fn(),
			entitiesDeleted: vi.fn(),
			entityPublished: vi.fn(),
			entityUnpublished: vi.fn(),
			draftSaved: vi.fn(),
			versionRestored: vi.fn(),
			operationFailed: vi.fn(),
			notAuthorized: vi.fn(),
			entityNotFound: vi.fn(),
			validationFailed: vi.fn(),
		};

		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptors([crudToastInterceptor])),
				provideHttpClientTesting(),
				{ provide: FeedbackService, useValue: feedback },
			],
		});

		http = TestBed.inject(HttpClient);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	// === Pass-through (no toast) ===

	it('should not intercept GET requests', () => {
		http.get('/api/posts').subscribe();

		const req = httpMock.expectOne('/api/posts');
		req.flush([]);

		expect(feedback.entityCreated).not.toHaveBeenCalled();
		expect(feedback.entityUpdated).not.toHaveBeenCalled();
		expect(feedback.entityDeleted).not.toHaveBeenCalled();
	});

	it('should not intercept non-collection routes', () => {
		http.post('/api/auth/login', {}).subscribe();

		const req = httpMock.expectOne('/api/auth/login');
		req.flush({});

		expect(feedback.entityCreated).not.toHaveBeenCalled();
	});

	it('should not intercept excluded slugs', () => {
		const excluded = ['auth', 'setup', 'health', 'config', 'access', 'graphql'];

		for (const slug of excluded) {
			http.post(`/api/${slug}`, {}).subscribe();

			const req = httpMock.expectOne(`/api/${slug}`);
			req.flush({});
		}

		expect(feedback.entityCreated).not.toHaveBeenCalled();
		expect(feedback.operationFailed).not.toHaveBeenCalled();
	});

	it('should not intercept non-API URLs', () => {
		http.post('/other/path', {}).subscribe();

		const req = httpMock.expectOne('/other/path');
		req.flush({});

		expect(feedback.entityCreated).not.toHaveBeenCalled();
	});

	it('should skip when SKIP_AUTO_TOAST is set', () => {
		const context = new HttpContext().set(SKIP_AUTO_TOAST, true);
		http.post('/api/posts', {}, { context }).subscribe();

		const req = httpMock.expectOne('/api/posts');
		req.flush({ doc: { id: '1' } });

		expect(feedback.entityCreated).not.toHaveBeenCalled();
	});

	// === Success toasts ===

	it('should show entityCreated on POST success', () => {
		http.post('/api/posts', { title: 'New' }).subscribe();

		const req = httpMock.expectOne('/api/posts');
		expect(req.request.method).toBe('POST');
		req.flush({ doc: { id: '1', title: 'New' } });

		expect(feedback.entityCreated).toHaveBeenCalledWith('Post');
	});

	it('should show entityUpdated on PATCH success', () => {
		http.patch('/api/posts/123', { title: 'Updated' }).subscribe();

		const req = httpMock.expectOne('/api/posts/123');
		expect(req.request.method).toBe('PATCH');
		req.flush({ doc: { id: '123', title: 'Updated' } });

		expect(feedback.entityUpdated).toHaveBeenCalledWith('Post');
	});

	it('should show entityUpdated on PUT success', () => {
		http.put('/api/posts/123', { title: 'Replaced' }).subscribe();

		const req = httpMock.expectOne('/api/posts/123');
		expect(req.request.method).toBe('PUT');
		req.flush({ doc: { id: '123', title: 'Replaced' } });

		expect(feedback.entityUpdated).toHaveBeenCalledWith('Post');
	});

	it('should show entityDeleted on DELETE success', () => {
		http.delete('/api/posts/123').subscribe();

		const req = httpMock.expectOne('/api/posts/123');
		expect(req.request.method).toBe('DELETE');
		req.flush({});

		expect(feedback.entityDeleted).toHaveBeenCalledWith('Post');
	});

	it('should humanize kebab-case slugs and singularize', () => {
		http.post('/api/blog-posts', {}).subscribe();

		const req = httpMock.expectOne('/api/blog-posts');
		req.flush({ doc: {} });

		expect(feedback.entityCreated).toHaveBeenCalledWith('Blog Post');
	});

	it('should not singularize words ending in ss', () => {
		// 'access' is excluded, so test with a custom slug
		http.post('/api/business', {}).subscribe();

		const req = httpMock.expectOne('/api/business');
		req.flush({ doc: {} });

		expect(feedback.entityCreated).toHaveBeenCalledWith('Business');
	});

	// === Batch operations ===

	it('should show entitiesDeleted with count for batch DELETE', () => {
		http.delete('/api/posts/batch').subscribe();

		const req = httpMock.expectOne('/api/posts/batch');
		req.flush({ docs: [{ id: '1' }, { id: '2' }, { id: '3' }] });

		expect(feedback.entitiesDeleted).toHaveBeenCalledWith('Post', 3);
	});

	it('should show entityCreated with count for batch POST', () => {
		http.post('/api/posts/batch', []).subscribe();

		const req = httpMock.expectOne('/api/posts/batch');
		req.flush({ docs: [{ id: '1' }, { id: '2' }] });

		expect(feedback.entityCreated).toHaveBeenCalledWith('2 posts');
	});

	it('should extract count from results array in batch', () => {
		http.delete('/api/posts/batch').subscribe();

		const req = httpMock.expectOne('/api/posts/batch');
		req.flush({ results: [{ id: '1' }] });

		expect(feedback.entitiesDeleted).toHaveBeenCalledWith('Post', 1);
	});

	it('should fallback to entityUpdated for batch without count', () => {
		http.patch('/api/posts/batch', {}).subscribe();

		const req = httpMock.expectOne('/api/posts/batch');
		req.flush({ success: true });

		expect(feedback.entityUpdated).toHaveBeenCalledWith('Post');
	});

	it('should use plural slug directly for batch POST (no naive re-pluralization)', () => {
		http.post('/api/business/batch', []).subscribe();

		const req = httpMock.expectOne('/api/business/batch');
		req.flush({ docs: [{ id: '1' }, { id: '2' }] });

		// Should be "2 business" not "2 businesss" (triple s)
		expect(feedback.entityCreated).toHaveBeenCalledWith('2 business');
	});

	// === Lifecycle sub-actions ===

	it('should show entityPublished for POST to /publish', () => {
		http.post('/api/posts/123/publish', {}).subscribe();

		const req = httpMock.expectOne('/api/posts/123/publish');
		req.flush({ doc: { id: '123' }, message: 'Published' });

		expect(feedback.entityPublished).toHaveBeenCalledWith('Post');
		expect(feedback.entityCreated).not.toHaveBeenCalled();
	});

	it('should show entityUnpublished for POST to /unpublish', () => {
		http.post('/api/posts/123/unpublish', {}).subscribe();

		const req = httpMock.expectOne('/api/posts/123/unpublish');
		req.flush({ doc: { id: '123' }, message: 'Unpublished' });

		expect(feedback.entityUnpublished).toHaveBeenCalledWith('Post');
		expect(feedback.entityCreated).not.toHaveBeenCalled();
	});

	it('should show draftSaved for POST to /draft', () => {
		http.post('/api/posts/123/draft', {}).subscribe();

		const req = httpMock.expectOne('/api/posts/123/draft');
		req.flush({ version: {}, message: 'Draft saved' });

		expect(feedback.draftSaved).toHaveBeenCalled();
		expect(feedback.entityCreated).not.toHaveBeenCalled();
	});

	it('should skip /status sub-action (no toast)', () => {
		http.get('/api/posts/123/status').subscribe();

		const req = httpMock.expectOne('/api/posts/123/status');
		req.flush({ status: 'published' });

		expect(feedback.entityCreated).not.toHaveBeenCalled();
		expect(feedback.entityUpdated).not.toHaveBeenCalled();
	});

	it('should skip /versions sub-action (no toast)', () => {
		http.get('/api/posts/123/versions').subscribe();

		const req = httpMock.expectOne('/api/posts/123/versions');
		req.flush({ docs: [] });

		expect(feedback.entityCreated).not.toHaveBeenCalled();
	});

	// === Error toasts ===

	it('should show notAuthorized on 403', () => {
		http.post('/api/posts', {}).subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts');
		req.flush({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

		expect(feedback.notAuthorized).toHaveBeenCalledWith('create this post');
	});

	it('should show entityNotFound on 404', () => {
		http.patch('/api/posts/999', {}).subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts/999');
		req.flush({ error: 'Not found' }, { status: 404, statusText: 'Not Found' });

		expect(feedback.entityNotFound).toHaveBeenCalledWith('Post');
	});

	it('should show validationFailed on 400 with errors array', () => {
		http.post('/api/posts', {}).subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts');
		req.flush(
			{
				errors: [
					{ field: 'title', message: 'required' },
					{ field: 'slug', message: 'required' },
				],
			},
			{ status: 400, statusText: 'Bad Request' },
		);

		expect(feedback.validationFailed).toHaveBeenCalledWith(2);
	});

	it('should show operationFailed with safe server error message on 500', () => {
		http.delete('/api/posts/123').subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts/123');
		req.flush({ error: 'Database connection lost' }, { status: 500, statusText: 'Server Error' });

		expect(feedback.operationFailed).toHaveBeenCalledWith('Database connection lost');
	});

	it('should sanitize server error messages containing SQL', () => {
		http.delete('/api/posts/123').subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts/123');
		req.flush(
			{ error: 'SELECT * FROM users WHERE id = 1' },
			{ status: 500, statusText: 'Server Error' },
		);

		expect(feedback.operationFailed).toHaveBeenCalledWith('Failed to delete post');
	});

	it('should sanitize server error messages containing file paths', () => {
		http.post('/api/posts', {}).subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts');
		req.flush(
			{ error: 'Error at /app/libs/server-core/handler.ts' },
			{ status: 500, statusText: 'Server Error' },
		);

		expect(feedback.operationFailed).toHaveBeenCalledWith('Failed to create post');
	});

	it('should sanitize server error messages containing stack traces', () => {
		http.patch('/api/posts/123', {}).subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts/123');
		req.flush(
			{ error: 'TypeError: Cannot read properties at module.js:42' },
			{ status: 500, statusText: 'Server Error' },
		);

		expect(feedback.operationFailed).toHaveBeenCalledWith('Failed to update post');
	});

	it('should show operationFailed with fallback message when no error string', () => {
		http.patch('/api/blog-posts/123', {}).subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/blog-posts/123');
		req.flush({}, { status: 500, statusText: 'Server Error' });

		expect(feedback.operationFailed).toHaveBeenCalledWith('Failed to update blog post');
	});

	it('should re-throw the error after showing toast', () => {
		const errorSpy = vi.fn();
		http.post('/api/posts', {}).subscribe({ error: errorSpy });

		const req = httpMock.expectOne('/api/posts');
		req.flush({ error: 'fail' }, { status: 500, statusText: 'Server Error' });

		expect(errorSpy).toHaveBeenCalled();
		expect(feedback.operationFailed).toHaveBeenCalled();
	});

	it('should show notAuthorized for DELETE 403', () => {
		http.delete('/api/posts/123').subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts/123');
		req.flush({}, { status: 403, statusText: 'Forbidden' });

		expect(feedback.notAuthorized).toHaveBeenCalledWith('delete this post');
	});

	it('should skip SKIP_AUTO_TOAST for error responses too', () => {
		const context = new HttpContext().set(SKIP_AUTO_TOAST, true);
		http.post('/api/posts', {}, { context }).subscribe({ error: vi.fn() });

		const req = httpMock.expectOne('/api/posts');
		req.flush({}, { status: 500, statusText: 'Server Error' });

		expect(feedback.operationFailed).not.toHaveBeenCalled();
	});
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WorkflowService } from '../workflow.service';

describe('WorkflowService', () => {
	let service: WorkflowService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(WorkflowService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	describe('transition', () => {
		it('POSTs to /api/:collection/:id/transition with the body', async () => {
			const promise = service.transition('articles', 'abc123', {
				toStage: 'in-review',
				comment: 'looks good',
			});
			const req = httpMock.expectOne('/api/articles/abc123/transition');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({ toStage: 'in-review', comment: 'looks good' });
			req.flush({
				id: 'abc123',
				fromStage: 'draft',
				toStage: 'in-review',
				workflowUpdatedAt: '2026-05-17T00:00:00.000Z',
				historyId: 'wh-1',
				published: false,
				unpublished: false,
			});
			const result = await promise;
			expect(result.toStage).toBe('in-review');
		});

		// Red-team finding #13: raw concatenation of path segments lets a docId
		// containing '/' or other URL-significant chars break the route entirely
		// — or worse, escape into another path on the same router. Doc ids are
		// UUIDs in practice but the service shouldn't trust that.
		it('URL-encodes the collection segment', () => {
			void service.transition('weird collection', 'abc', { toStage: 'next' });
			const req = httpMock.expectOne('/api/weird%20collection/abc/transition');
			req.flush({});
		});

		it('URL-encodes the docId segment (defeats path injection via id)', () => {
			void service.transition('articles', '../../etc/passwd', { toStage: 'next' });
			// '../' must not appear unencoded — encodeURIComponent turns '/' into %2F.
			const req = httpMock.expectOne('/api/articles/..%2F..%2Fetc%2Fpasswd/transition');
			req.flush({});
		});

		it('URL-encodes a docId containing reserved query chars', () => {
			void service.transition('articles', 'id?with=query&extra', { toStage: 'next' });
			const req = httpMock.expectOne('/api/articles/id%3Fwith%3Dquery%26extra/transition');
			req.flush({});
		});
	});

	describe('listHistory', () => {
		it('GETs /api/:collection/:id/workflow-history with pagination params', () => {
			void service.listHistory('articles', 'abc123', { limit: 25, page: 2 });
			const req = httpMock.expectOne(
				(r) =>
					r.url === '/api/articles/abc123/workflow-history' &&
					r.params.get('limit') === '25' &&
					r.params.get('page') === '2',
			);
			expect(req.request.method).toBe('GET');
			req.flush({
				docs: [],
				totalDocs: 0,
				totalPages: 0,
				page: 2,
				limit: 25,
				hasNextPage: false,
				hasPrevPage: true,
			});
		});

		it('URL-encodes path segments for listHistory', () => {
			void service.listHistory('articles', 'id/with/slash');
			const req = httpMock.expectOne(
				(r) => r.url === '/api/articles/id%2Fwith%2Fslash/workflow-history',
			);
			req.flush({
				docs: [],
				totalDocs: 0,
				totalPages: 0,
				page: 1,
				limit: 25,
				hasNextPage: false,
				hasPrevPage: false,
			});
		});
	});
});

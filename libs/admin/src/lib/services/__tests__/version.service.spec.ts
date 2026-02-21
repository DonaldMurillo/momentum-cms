import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
	VersionService,
	type VersionQueryResult,
	type DocumentVersionParsed,
	type RestoreResult,
	type PublishResult,
	type DraftSaveResult,
	type StatusResult,
	type VersionCompareResult,
	type VersionFieldDiff,
} from '../version.service';

describe('VersionService', () => {
	let service: VersionService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(VersionService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	// ============================================
	// Fixtures
	// ============================================

	const mockVersionQueryResult: VersionQueryResult = {
		docs: [],
		totalDocs: 0,
		totalPages: 0,
		page: 1,
		limit: 10,
		hasNextPage: false,
		hasPrevPage: false,
	};

	const mockVersion: DocumentVersionParsed = {
		id: 'v1',
		parent: 'abc123',
		version: { title: 'Test' },
		_status: 'draft',
		autosave: false,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};

	const mockRestoreResult: RestoreResult = {
		doc: { title: 'Restored' },
		message: 'Version restored successfully',
	};

	const mockPublishResult: PublishResult = {
		doc: { title: 'Published' },
		message: 'Document published successfully',
	};

	const mockDraftSaveResult: DraftSaveResult = {
		version: mockVersion,
		message: 'Draft saved successfully',
	};

	const mockStatusResult: StatusResult = {
		status: 'published',
	};

	const mockDiffs: VersionFieldDiff[] = [
		{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' },
		{ field: 'content', oldValue: 'Old Content', newValue: 'New Content' },
	];

	const mockCompareResult: VersionCompareResult = {
		differences: mockDiffs,
	};

	// ============================================
	// Signal Defaults
	// ============================================

	describe('signal defaults', () => {
		it('isLoading should default to false', () => {
			expect(service.isLoading()).toBe(false);
		});

		it('error should default to null', () => {
			expect(service.error()).toBeNull();
		});

		it('lastSaved should default to null', () => {
			expect(service.lastSaved()).toBeNull();
		});
	});

	// ============================================
	// URL Building - Observable Methods
	// ============================================

	describe('findVersions$', () => {
		it('should GET /api/{collection}/{docId}/versions', () => {
			service.findVersions$('posts', 'abc123').subscribe((result) => {
				expect(result).toEqual(mockVersionQueryResult);
			});

			const req = httpMock.expectOne('/api/posts/abc123/versions');
			expect(req.request.method).toBe('GET');
			req.flush(mockVersionQueryResult);
		});

		it('should include query params from options', () => {
			service
				.findVersions$('posts', 'abc123', {
					limit: 20,
					page: 2,
					includeAutosave: true,
					status: 'draft',
				})
				.subscribe();

			const req = httpMock.expectOne(
				(r) => r.url === '/api/posts/abc123/versions' && r.method === 'GET',
			);
			expect(req.request.params.get('limit')).toBe('20');
			expect(req.request.params.get('page')).toBe('2');
			expect(req.request.params.get('includeAutosave')).toBe('true');
			expect(req.request.params.get('status')).toBe('draft');
			req.flush(mockVersionQueryResult);
		});
	});

	describe('findVersionById$', () => {
		it('should GET /api/{collection}/{docId}/versions/{versionId}', () => {
			service.findVersionById$('posts', 'abc123', 'v1').subscribe((result) => {
				expect(result).toEqual(mockVersion);
			});

			const req = httpMock.expectOne('/api/posts/abc123/versions/v1');
			expect(req.request.method).toBe('GET');
			req.flush(mockVersion);
		});
	});

	describe('restore$', () => {
		it('should POST /api/{collection}/{docId}/versions/restore', () => {
			const options = { versionId: 'v1', publish: false };

			service.restore$('posts', 'abc123', options).subscribe((result) => {
				expect(result).toEqual(mockRestoreResult);
			});

			const req = httpMock.expectOne('/api/posts/abc123/versions/restore');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual(options);
			req.flush(mockRestoreResult);
		});
	});

	describe('publish$', () => {
		it('should POST /api/{collection}/{docId}/publish', () => {
			service.publish$('posts', 'abc123').subscribe((result) => {
				expect(result).toEqual(mockPublishResult);
			});

			const req = httpMock.expectOne('/api/posts/abc123/publish');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({});
			req.flush(mockPublishResult);
		});
	});

	describe('unpublish$', () => {
		it('should POST /api/{collection}/{docId}/unpublish', () => {
			service.unpublish$('posts', 'abc123').subscribe((result) => {
				expect(result).toEqual(mockPublishResult);
			});

			const req = httpMock.expectOne('/api/posts/abc123/unpublish');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({});
			req.flush(mockPublishResult);
		});
	});

	describe('saveDraft$', () => {
		it('should POST /api/{collection}/{docId}/draft', () => {
			const draftData = { title: 'Draft Title' };

			service.saveDraft$('posts', 'abc123', draftData).subscribe((result) => {
				expect(result).toEqual(mockDraftSaveResult);
			});

			const req = httpMock.expectOne('/api/posts/abc123/draft');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual(draftData);
			req.flush(mockDraftSaveResult);
		});

		it('should update lastSaved signal after response', () => {
			expect(service.lastSaved()).toBeNull();

			const beforeSave = new Date();

			service.saveDraft$('posts', 'abc123', { title: 'Draft' }).subscribe();

			const req = httpMock.expectOne('/api/posts/abc123/draft');
			req.flush(mockDraftSaveResult);

			const afterSave = new Date();
			const lastSaved = service.lastSaved();

			expect(lastSaved).not.toBeNull();
			expect(lastSaved!.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
			expect(lastSaved!.getTime()).toBeLessThanOrEqual(afterSave.getTime());
		});
	});

	describe('getStatus$', () => {
		it('should GET /api/{collection}/{docId}/status', () => {
			service.getStatus$('posts', 'abc123').subscribe();

			const req = httpMock.expectOne('/api/posts/abc123/status');
			expect(req.request.method).toBe('GET');
			req.flush(mockStatusResult);
		});

		it('should extract status from response', () => {
			service.getStatus$('posts', 'abc123').subscribe((status) => {
				expect(status).toBe('published');
			});

			const req = httpMock.expectOne('/api/posts/abc123/status');
			req.flush(mockStatusResult);
		});
	});

	describe('compareVersions$', () => {
		it('should POST /api/{collection}/{docId}/versions/compare', () => {
			service.compareVersions$('posts', 'abc123', 'v1', 'v2').subscribe();

			const req = httpMock.expectOne('/api/posts/abc123/versions/compare');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({ versionId1: 'v1', versionId2: 'v2' });
			req.flush(mockCompareResult);
		});

		it('should extract differences from response', () => {
			service.compareVersions$('posts', 'abc123', 'v1', 'v2').subscribe((diffs) => {
				expect(diffs).toEqual(mockDiffs);
				expect(diffs).toHaveLength(2);
				expect(diffs[0].field).toBe('title');
			});

			const req = httpMock.expectOne('/api/posts/abc123/versions/compare');
			req.flush(mockCompareResult);
		});
	});

	// ============================================
	// Promise Wrappers
	// ============================================

	describe('promise wrappers', () => {
		it('findVersions should return promise', async () => {
			const promise = service.findVersions('posts', 'abc123');

			const req = httpMock.expectOne('/api/posts/abc123/versions');
			req.flush(mockVersionQueryResult);

			const result = await promise;
			expect(result).toEqual(mockVersionQueryResult);
		});

		it('findVersionById should return promise', async () => {
			const promise = service.findVersionById('posts', 'abc123', 'v1');

			const req = httpMock.expectOne('/api/posts/abc123/versions/v1');
			req.flush(mockVersion);

			const result = await promise;
			expect(result).toEqual(mockVersion);
		});

		it('restore should return promise', async () => {
			const options = { versionId: 'v1' };
			const promise = service.restore('posts', 'abc123', options);

			const req = httpMock.expectOne('/api/posts/abc123/versions/restore');
			req.flush(mockRestoreResult);

			const result = await promise;
			expect(result).toEqual(mockRestoreResult);
		});

		it('publish should return promise', async () => {
			const promise = service.publish('posts', 'abc123');

			const req = httpMock.expectOne('/api/posts/abc123/publish');
			req.flush(mockPublishResult);

			const result = await promise;
			expect(result).toEqual(mockPublishResult);
		});

		it('unpublish should return promise', async () => {
			const promise = service.unpublish('posts', 'abc123');

			const req = httpMock.expectOne('/api/posts/abc123/unpublish');
			req.flush(mockPublishResult);

			const result = await promise;
			expect(result).toEqual(mockPublishResult);
		});

		it('saveDraft should return promise', async () => {
			const promise = service.saveDraft('posts', 'abc123', { title: 'Draft' });

			const req = httpMock.expectOne('/api/posts/abc123/draft');
			req.flush(mockDraftSaveResult);

			const result = await promise;
			expect(result).toEqual(mockDraftSaveResult);
		});

		it('getStatus should return promise', async () => {
			const promise = service.getStatus('posts', 'abc123');

			const req = httpMock.expectOne('/api/posts/abc123/status');
			req.flush(mockStatusResult);

			const result = await promise;
			expect(result).toBe('published');
		});

		it('compareVersions should return promise', async () => {
			const promise = service.compareVersions('posts', 'abc123', 'v1', 'v2');

			const req = httpMock.expectOne('/api/posts/abc123/versions/compare');
			req.flush(mockCompareResult);

			const result = await promise;
			expect(result).toEqual(mockDiffs);
		});
	});

	// ============================================
	// Query Params
	// ============================================

	describe('query params', () => {
		it('should include limit param', () => {
			service.findVersions$('posts', 'abc123', { limit: 5 }).subscribe();

			const req = httpMock.expectOne(
				(r) => r.url === '/api/posts/abc123/versions' && r.method === 'GET',
			);
			expect(req.request.params.get('limit')).toBe('5');
			req.flush(mockVersionQueryResult);
		});

		it('should include page param', () => {
			service.findVersions$('posts', 'abc123', { page: 3 }).subscribe();

			const req = httpMock.expectOne(
				(r) => r.url === '/api/posts/abc123/versions' && r.method === 'GET',
			);
			expect(req.request.params.get('page')).toBe('3');
			req.flush(mockVersionQueryResult);
		});

		it('should include includeAutosave param', () => {
			service.findVersions$('posts', 'abc123', { includeAutosave: false }).subscribe();

			const req = httpMock.expectOne(
				(r) => r.url === '/api/posts/abc123/versions' && r.method === 'GET',
			);
			expect(req.request.params.get('includeAutosave')).toBe('false');
			req.flush(mockVersionQueryResult);
		});

		it('should include status param', () => {
			service.findVersions$('posts', 'abc123', { status: 'published' }).subscribe();

			const req = httpMock.expectOne(
				(r) => r.url === '/api/posts/abc123/versions' && r.method === 'GET',
			);
			expect(req.request.params.get('status')).toBe('published');
			req.flush(mockVersionQueryResult);
		});

		it('should handle empty options', () => {
			service.findVersions$('posts', 'abc123', {}).subscribe();

			const req = httpMock.expectOne('/api/posts/abc123/versions');
			expect(req.request.params.keys()).toHaveLength(0);
			req.flush(mockVersionQueryResult);
		});

		it('should handle undefined options', () => {
			service.findVersions$('posts', 'abc123').subscribe();

			const req = httpMock.expectOne('/api/posts/abc123/versions');
			expect(req.request.params.keys()).toHaveLength(0);
			req.flush(mockVersionQueryResult);
		});
	});
});

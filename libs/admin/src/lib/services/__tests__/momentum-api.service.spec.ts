import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import {
	injectMomentumAPI,
	type MomentumClientAPI,
	type MomentumCollectionAPI,
	type MomentumGlobalAPI,
	type FindResult,
	type DeleteResult,
} from '../momentum-api.service';

// ============================================
// Test Types
// ============================================

interface TestPost {
	id: string;
	title: string;
	content: string;
}

// ============================================
// Fixtures
// ============================================

const mockPost: TestPost = {
	id: 'post-1',
	title: 'Test Post',
	content: 'Hello World',
};

const mockPost2: TestPost = {
	id: 'post-2',
	title: 'Second Post',
	content: 'Goodbye World',
};

const _mockFindResult: FindResult<TestPost> = {
	docs: [mockPost, mockPost2],
	totalDocs: 2,
	totalPages: 1,
	page: 1,
	limit: 10,
	hasNextPage: false,
	hasPrevPage: false,
};

const mockDeleteResult: DeleteResult = {
	id: 'post-1',
	deleted: true,
};

// ============================================
// Test Suite
// ============================================

describe('MomentumAPI - Browser Implementation', () => {
	let api: MomentumClientAPI;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
			],
		});

		api = TestBed.runInInjectionContext(() => injectMomentumAPI());
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	// ============================================
	// BrowserMomentumAPI - Factory
	// ============================================

	describe('injectMomentumAPI', () => {
		it('should create an API instance in browser context', () => {
			expect(api).toBeDefined();
			expect(api.collection).toBeDefined();
			expect(api.global).toBeDefined();
		});

		it('should return a collection API from collection()', () => {
			const postsApi = api.collection<TestPost>('posts');
			expect(postsApi).toBeDefined();
			expect(postsApi.find$).toBeDefined();
			expect(postsApi.findById$).toBeDefined();
			expect(postsApi.create$).toBeDefined();
			expect(postsApi.update$).toBeDefined();
			expect(postsApi.delete$).toBeDefined();
		});

		it('should return a global API from global()', () => {
			const settingsApi = api.global('settings');
			expect(settingsApi).toBeDefined();
			expect(settingsApi.findOne$).toBeDefined();
			expect(settingsApi.update$).toBeDefined();
		});
	});

	// ============================================
	// BrowserCollectionAPI - find$
	// ============================================

	describe('BrowserCollectionAPI.find$', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('should GET /api/posts with no params when no options provided', () => {
			postsApi.find$().subscribe();

			const req = httpMock.expectOne('/api/posts');
			expect(req.request.method).toBe('GET');
			expect(req.request.params.keys()).toHaveLength(0);
			req.flush({ docs: [mockPost], totalDocs: 1 });
		});

		it('should map the API response to a FindResult with pagination', () => {
			postsApi.find$().subscribe((result) => {
				expect(result.docs).toEqual([mockPost, mockPost2]);
				expect(result.totalDocs).toBe(2);
				expect(result.totalPages).toBe(1);
				expect(result.page).toBe(1);
				expect(result.limit).toBe(10);
				expect(result.hasNextPage).toBe(false);
				expect(result.hasPrevPage).toBe(false);
			});

			const req = httpMock.expectOne('/api/posts');
			req.flush({ docs: [mockPost, mockPost2], totalDocs: 2 });
		});

		it('should include where params when provided', () => {
			const where = { status: { equals: 'published' } };
			postsApi.find$({ where }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('where')).toBe(JSON.stringify(where));
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should include limit param', () => {
			postsApi.find$({ limit: 25 }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('limit')).toBe('25');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should include page param', () => {
			postsApi.find$({ page: 3 }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('page')).toBe('3');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should include sort param', () => {
			postsApi.find$({ sort: '-createdAt' }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('sort')).toBe('-createdAt');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should include depth param', () => {
			postsApi.find$({ depth: 2 }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('depth')).toBe('2');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should include withDeleted param', () => {
			postsApi.find$({ withDeleted: true }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('withDeleted')).toBe('true');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should include onlyDeleted param', () => {
			postsApi.find$({ onlyDeleted: true }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('onlyDeleted')).toBe('true');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should include all params simultaneously', () => {
			postsApi
				.find$({
					where: { title: 'Test' },
					sort: 'title',
					limit: 5,
					page: 2,
					depth: 1,
				})
				.subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('where')).toBe(JSON.stringify({ title: 'Test' }));
			expect(req.request.params.get('sort')).toBe('title');
			expect(req.request.params.get('limit')).toBe('5');
			expect(req.request.params.get('page')).toBe('2');
			expect(req.request.params.get('depth')).toBe('1');
			req.flush({ docs: [mockPost], totalDocs: 1 });
		});

		it('should handle empty options object', () => {
			postsApi.find$({}).subscribe();

			const req = httpMock.expectOne('/api/posts');
			expect(req.request.params.keys()).toHaveLength(0);
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should compute pagination correctly', () => {
			postsApi.find$({ limit: 2, page: 1 }).subscribe((result) => {
				expect(result.totalPages).toBe(3);
				expect(result.hasNextPage).toBe(true);
				expect(result.hasPrevPage).toBe(false);
				expect(result.nextPage).toBe(2);
				expect(result.prevPage).toBeUndefined();
			});

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			req.flush({ docs: [mockPost, mockPost2], totalDocs: 5 });
		});

		it('should compute hasPrevPage on later pages', () => {
			postsApi.find$({ limit: 2, page: 2 }).subscribe((result) => {
				expect(result.page).toBe(2);
				expect(result.hasPrevPage).toBe(true);
				expect(result.prevPage).toBe(1);
				expect(result.hasNextPage).toBe(true);
				expect(result.nextPage).toBe(3);
			});

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			req.flush({ docs: [mockPost, mockPost2], totalDocs: 5 });
		});

		it('should default limit to 10 when not provided', () => {
			postsApi.find$().subscribe((result) => {
				expect(result.limit).toBe(10);
			});

			const req = httpMock.expectOne('/api/posts');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should default page to 1 when not provided', () => {
			postsApi.find$().subscribe((result) => {
				expect(result.page).toBe(1);
			});

			const req = httpMock.expectOne('/api/posts');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should handle response with missing docs array', () => {
			postsApi.find$().subscribe((result) => {
				expect(result.docs).toEqual([]);
				expect(result.totalDocs).toBe(0);
			});

			const req = httpMock.expectOne('/api/posts');
			req.flush({});
		});
	});

	// ============================================
	// BrowserCollectionAPI - findById$
	// ============================================

	describe('BrowserCollectionAPI.findById$', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('should GET /api/posts/{id}', () => {
			postsApi.findById$('post-1').subscribe((result) => {
				expect(result).toEqual(mockPost);
			});

			const req = httpMock.expectOne('/api/posts/post-1');
			expect(req.request.method).toBe('GET');
			req.flush({ doc: mockPost });
		});

		it('should include depth param', () => {
			postsApi.findById$('post-1', { depth: 3 }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/post-1' && r.method === 'GET');
			expect(req.request.params.get('depth')).toBe('3');
			req.flush({ doc: mockPost });
		});

		it('should include withDeleted param', () => {
			postsApi.findById$('post-1', { withDeleted: true }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts/post-1' && r.method === 'GET');
			expect(req.request.params.get('withDeleted')).toBe('true');
			req.flush({ doc: mockPost });
		});

		it('should return null when doc is missing from response', () => {
			postsApi.findById$('post-999').subscribe((result) => {
				expect(result).toBeNull();
			});

			const req = httpMock.expectOne('/api/posts/post-999');
			req.flush({});
		});

		it('should not include params when no options provided', () => {
			postsApi.findById$('post-1').subscribe();

			const req = httpMock.expectOne('/api/posts/post-1');
			expect(req.request.params.keys()).toHaveLength(0);
			req.flush({ doc: mockPost });
		});
	});

	// ============================================
	// BrowserCollectionAPI - create$
	// ============================================

	describe('BrowserCollectionAPI.create$', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('should POST /api/posts with data', () => {
			const newPost = { title: 'New Post', content: 'New Content' };

			postsApi.create$(newPost).subscribe((result) => {
				expect(result).toEqual(mockPost);
			});

			const req = httpMock.expectOne('/api/posts');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual(newPost);
			req.flush({ doc: mockPost });
		});
	});

	// ============================================
	// BrowserCollectionAPI - update$
	// ============================================

	describe('BrowserCollectionAPI.update$', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('should PATCH /api/posts/{id} with data', () => {
			const updateData = { title: 'Updated Title' };

			postsApi.update$('post-1', updateData).subscribe((result) => {
				expect(result).toEqual({ ...mockPost, title: 'Updated Title' });
			});

			const req = httpMock.expectOne('/api/posts/post-1');
			expect(req.request.method).toBe('PATCH');
			expect(req.request.body).toEqual(updateData);
			req.flush({ doc: { ...mockPost, title: 'Updated Title' } });
		});
	});

	// ============================================
	// BrowserCollectionAPI - delete$
	// ============================================

	describe('BrowserCollectionAPI.delete$', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('should DELETE /api/posts/{id}', () => {
			postsApi.delete$('post-1').subscribe((result) => {
				expect(result).toEqual(mockDeleteResult);
			});

			const req = httpMock.expectOne('/api/posts/post-1');
			expect(req.request.method).toBe('DELETE');
			req.flush({ id: 'post-1', deleted: true });
		});

		it('should use response id and deleted fields', () => {
			postsApi.delete$('post-1').subscribe((result) => {
				expect(result.id).toBe('post-1');
				expect(result.deleted).toBe(true);
			});

			const req = httpMock.expectOne('/api/posts/post-1');
			req.flush({ id: 'post-1', deleted: true });
		});

		it('should fallback to request id when response id is missing', () => {
			postsApi.delete$('post-1').subscribe((result) => {
				expect(result.id).toBe('post-1');
				expect(result.deleted).toBe(false);
			});

			const req = httpMock.expectOne('/api/posts/post-1');
			req.flush({});
		});
	});

	// ============================================
	// BrowserCollectionAPI - forceDelete$
	// ============================================

	describe('BrowserCollectionAPI.forceDelete$', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('should DELETE /api/posts/{id} with force=true param', () => {
			postsApi.forceDelete$('post-1').subscribe((result) => {
				expect(result.id).toBe('post-1');
				expect(result.deleted).toBe(true);
			});

			const req = httpMock.expectOne((r) => r.url === '/api/posts/post-1' && r.method === 'DELETE');
			expect(req.request.params.get('force')).toBe('true');
			req.flush({ id: 'post-1', deleted: true });
		});
	});

	// ============================================
	// BrowserCollectionAPI - restore$
	// ============================================

	describe('BrowserCollectionAPI.restore$', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('should POST /api/posts/{id}/restore', () => {
			postsApi.restore$('post-1').subscribe((result) => {
				expect(result).toEqual(mockPost);
			});

			const req = httpMock.expectOne('/api/posts/post-1/restore');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({});
			req.flush({ doc: mockPost });
		});
	});

	// ============================================
	// BrowserCollectionAPI - Batch Operations
	// ============================================

	describe('BrowserCollectionAPI batch operations', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('batchCreate$ should POST /api/posts/batch with create operation', () => {
			const items = [
				{ title: 'Post A', content: 'Content A' },
				{ title: 'Post B', content: 'Content B' },
			];

			postsApi.batchCreate$(items).subscribe((result) => {
				expect(result).toHaveLength(2);
			});

			const req = httpMock.expectOne('/api/posts/batch');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({ operation: 'create', items });
			req.flush({ docs: [mockPost, mockPost2] });
		});

		it('batchUpdate$ should POST /api/posts/batch with update operation', () => {
			const items = [
				{ id: 'post-1', data: { title: 'Updated A' } },
				{ id: 'post-2', data: { title: 'Updated B' } },
			];

			postsApi.batchUpdate$(items).subscribe((result) => {
				expect(result).toHaveLength(2);
			});

			const req = httpMock.expectOne('/api/posts/batch');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({ operation: 'update', items });
			req.flush({ docs: [mockPost, mockPost2] });
		});

		it('batchDelete$ should POST /api/posts/batch with delete operation', () => {
			const ids = ['post-1', 'post-2'];

			postsApi.batchDelete$(ids).subscribe((result) => {
				expect(result).toEqual([
					{ id: 'post-1', deleted: true },
					{ id: 'post-2', deleted: true },
				]);
			});

			const req = httpMock.expectOne('/api/posts/batch');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toEqual({ operation: 'delete', ids });
			req.flush({
				results: [
					{ id: 'post-1', deleted: true },
					{ id: 'post-2', deleted: true },
				],
			});
		});

		it('batchCreate$ should handle empty docs response', () => {
			postsApi.batchCreate$([{ title: 'Post' }]).subscribe((result) => {
				expect(result).toEqual([]);
			});

			const req = httpMock.expectOne('/api/posts/batch');
			req.flush({});
		});

		it('batchDelete$ should handle missing results', () => {
			postsApi.batchDelete$(['post-1']).subscribe((result) => {
				expect(result).toEqual([]);
			});

			const req = httpMock.expectOne('/api/posts/batch');
			req.flush({});
		});
	});

	// ============================================
	// BrowserCollectionAPI - Promise Wrappers
	// ============================================

	describe('BrowserCollectionAPI promise wrappers', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('find should return a promise', async () => {
			const promise = postsApi.find();

			const req = httpMock.expectOne('/api/posts');
			req.flush({ docs: [mockPost], totalDocs: 1 });

			const result = await promise;
			expect(result.docs).toEqual([mockPost]);
		});

		it('findById should return a promise', async () => {
			const promise = postsApi.findById('post-1');

			const req = httpMock.expectOne('/api/posts/post-1');
			req.flush({ doc: mockPost });

			const result = await promise;
			expect(result).toEqual(mockPost);
		});

		it('create should return a promise', async () => {
			const promise = postsApi.create({ title: 'New Post', content: 'Content' });

			const req = httpMock.expectOne('/api/posts');
			req.flush({ doc: mockPost });

			const result = await promise;
			expect(result).toEqual(mockPost);
		});

		it('update should return a promise', async () => {
			const promise = postsApi.update('post-1', { title: 'Updated' });

			const req = httpMock.expectOne('/api/posts/post-1');
			req.flush({ doc: { ...mockPost, title: 'Updated' } });

			const result = await promise;
			expect(result.title).toBe('Updated');
		});

		it('delete should return a promise', async () => {
			const promise = postsApi.delete('post-1');

			const req = httpMock.expectOne('/api/posts/post-1');
			req.flush({ id: 'post-1', deleted: true });

			const result = await promise;
			expect(result).toEqual(mockDeleteResult);
		});

		it('forceDelete should return a promise', async () => {
			const promise = postsApi.forceDelete('post-1');

			const req = httpMock.expectOne((r) => r.url === '/api/posts/post-1' && r.method === 'DELETE');
			req.flush({ id: 'post-1', deleted: true });

			const result = await promise;
			expect(result).toEqual(mockDeleteResult);
		});

		it('restore should return a promise', async () => {
			const promise = postsApi.restore('post-1');

			const req = httpMock.expectOne('/api/posts/post-1/restore');
			req.flush({ doc: mockPost });

			const result = await promise;
			expect(result).toEqual(mockPost);
		});

		it('batchCreate should return a promise', async () => {
			const promise = postsApi.batchCreate([{ title: 'Batch' }]);

			const req = httpMock.expectOne('/api/posts/batch');
			req.flush({ docs: [mockPost] });

			const result = await promise;
			expect(result).toEqual([mockPost]);
		});

		it('batchUpdate should return a promise', async () => {
			const promise = postsApi.batchUpdate([{ id: 'post-1', data: { title: 'Updated' } }]);

			const req = httpMock.expectOne('/api/posts/batch');
			req.flush({ docs: [mockPost] });

			const result = await promise;
			expect(result).toEqual([mockPost]);
		});

		it('batchDelete should return a promise', async () => {
			const promise = postsApi.batchDelete(['post-1']);

			const req = httpMock.expectOne('/api/posts/batch');
			req.flush({ results: [{ id: 'post-1', deleted: true }] });

			const result = await promise;
			expect(result).toEqual([{ id: 'post-1', deleted: true }]);
		});
	});

	// ============================================
	// BrowserCollectionAPI - Different Collection Slugs
	// ============================================

	describe('collection slug routing', () => {
		it('should route to the correct collection endpoint', () => {
			const usersApi = api.collection('users');
			const pagesApi = api.collection('pages');

			usersApi.find$().subscribe();
			const usersReq = httpMock.expectOne('/api/users');
			expect(usersReq.request.method).toBe('GET');
			usersReq.flush({ docs: [], totalDocs: 0 });

			pagesApi.find$().subscribe();
			const pagesReq = httpMock.expectOne('/api/pages');
			expect(pagesReq.request.method).toBe('GET');
			pagesReq.flush({ docs: [], totalDocs: 0 });
		});

		it('should handle kebab-case slugs', () => {
			const blogPostsApi = api.collection('blog-posts');

			blogPostsApi.find$().subscribe();

			const req = httpMock.expectOne('/api/blog-posts');
			expect(req.request.method).toBe('GET');
			req.flush({ docs: [], totalDocs: 0 });
		});
	});

	// ============================================
	// BrowserGlobalAPI
	// ============================================

	describe('BrowserGlobalAPI', () => {
		let settingsApi: MomentumGlobalAPI<{ siteName: string; theme: string }>;

		beforeEach(() => {
			settingsApi = api.global<{ siteName: string; theme: string }>('settings');
		});

		describe('findOne$', () => {
			it('should GET /api/globals/settings', () => {
				settingsApi.findOne$().subscribe((result) => {
					expect(result).toEqual({ siteName: 'My Site', theme: 'dark' });
				});

				const req = httpMock.expectOne('/api/globals/settings');
				expect(req.request.method).toBe('GET');
				req.flush({ doc: { siteName: 'My Site', theme: 'dark' } });
			});

			it('should include depth param', () => {
				settingsApi.findOne$({ depth: 2 }).subscribe();

				const req = httpMock.expectOne(
					(r) => r.url === '/api/globals/settings' && r.method === 'GET',
				);
				expect(req.request.params.get('depth')).toBe('2');
				req.flush({ doc: { siteName: 'My Site', theme: 'dark' } });
			});

			it('should not include depth param when not provided', () => {
				settingsApi.findOne$().subscribe();

				const req = httpMock.expectOne('/api/globals/settings');
				expect(req.request.params.keys()).toHaveLength(0);
				req.flush({ doc: { siteName: 'My Site', theme: 'dark' } });
			});
		});

		describe('update$', () => {
			it('should PATCH /api/globals/settings with data', () => {
				const updateData = { siteName: 'Updated Site' };

				settingsApi.update$(updateData).subscribe((result) => {
					expect(result).toEqual({ siteName: 'Updated Site', theme: 'dark' });
				});

				const req = httpMock.expectOne('/api/globals/settings');
				expect(req.request.method).toBe('PATCH');
				expect(req.request.body).toEqual(updateData);
				req.flush({ doc: { siteName: 'Updated Site', theme: 'dark' } });
			});
		});

		describe('promise wrappers', () => {
			it('findOne should return a promise', async () => {
				const promise = settingsApi.findOne();

				const req = httpMock.expectOne('/api/globals/settings');
				req.flush({ doc: { siteName: 'My Site', theme: 'dark' } });

				const result = await promise;
				expect(result).toEqual({ siteName: 'My Site', theme: 'dark' });
			});

			it('update should return a promise', async () => {
				const promise = settingsApi.update({ theme: 'light' });

				const req = httpMock.expectOne('/api/globals/settings');
				req.flush({ doc: { siteName: 'My Site', theme: 'light' } });

				const result = await promise;
				expect(result.theme).toBe('light');
			});
		});
	});

	// ============================================
	// BrowserGlobalAPI - Different Slugs
	// ============================================

	describe('global slug routing', () => {
		it('should route to correct global endpoint', () => {
			const navApi = api.global('navigation');

			navApi.findOne$().subscribe();

			const req = httpMock.expectOne('/api/globals/navigation');
			expect(req.request.method).toBe('GET');
			req.flush({ doc: { items: [] } });
		});
	});

	// ============================================
	// Query Param Serialization
	// ============================================

	describe('query param serialization', () => {
		let postsApi: MomentumCollectionAPI<TestPost>;

		beforeEach(() => {
			postsApi = api.collection<TestPost>('posts');
		});

		it('should serialize nested where clause as JSON', () => {
			const where = {
				and: [{ title: { contains: 'hello' } }, { status: { equals: 'published' } }],
			};

			postsApi.find$({ where }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('where')).toBe(JSON.stringify(where));
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should not set params for undefined values', () => {
			postsApi
				.find$({
					limit: undefined,
					page: undefined,
					sort: undefined,
					where: undefined,
					depth: undefined,
				})
				.subscribe();

			const req = httpMock.expectOne('/api/posts');
			expect(req.request.params.keys()).toHaveLength(0);
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should handle depth of 0', () => {
			postsApi.find$({ depth: 0 }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('depth')).toBe('0');
			req.flush({ docs: [], totalDocs: 0 });
		});

		it('should handle limit of 0', () => {
			postsApi.find$({ limit: 0 }).subscribe();

			const req = httpMock.expectOne((r) => r.url === '/api/posts' && r.method === 'GET');
			expect(req.request.params.get('limit')).toBe('0');
			req.flush({ docs: [], totalDocs: 0 });
		});
	});
});

// ============================================
// TransferState Tests (separate TestBed config)
// ============================================

describe('MomentumAPI - TransferState Integration', () => {
	let api: MomentumClientAPI;
	let httpMock: HttpTestingController;
	let transferState: TransferState;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				TransferState,
			],
		});

		api = TestBed.runInInjectionContext(() => injectMomentumAPI());
		httpMock = TestBed.inject(HttpTestingController);
		transferState = TestBed.inject(TransferState);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('should use TransferState cache when data is available (find$)', () => {
		// Pre-populate the TransferState with cached data using the same key format
		// The key format is: mcms:{slug}:{operation}:{base64-hash}
		const cachedResult: FindResult<TestPost> = {
			docs: [mockPost],
			totalDocs: 1,
			totalPages: 1,
			page: 1,
			limit: 10,
			hasNextPage: false,
			hasPrevPage: false,
		};

		const key = makeStateKey<FindResult<TestPost>>('mcms:posts:find');
		transferState.set(key, cachedResult);

		const postsApi = api.collection<TestPost>('posts');

		postsApi.find$().subscribe((result) => {
			expect(result).toEqual(cachedResult);
		});

		// No HTTP request should be made when cache hit
		httpMock.expectNone('/api/posts');
	});

	it('should remove TransferState key after cache hit (find$)', () => {
		const cachedResult: FindResult<TestPost> = {
			docs: [mockPost],
			totalDocs: 1,
			totalPages: 1,
			page: 1,
			limit: 10,
			hasNextPage: false,
			hasPrevPage: false,
		};

		const key = makeStateKey<FindResult<TestPost>>('mcms:posts:find');
		transferState.set(key, cachedResult);

		const postsApi = api.collection<TestPost>('posts');

		postsApi.find$().subscribe();

		// After consuming the cache, the key should be removed
		expect(transferState.get(key, null)).toBeNull();
	});

	it('should skip TransferState when transfer: false (find$)', () => {
		const cachedResult: FindResult<TestPost> = {
			docs: [mockPost],
			totalDocs: 1,
			totalPages: 1,
			page: 1,
			limit: 10,
			hasNextPage: false,
			hasPrevPage: false,
		};

		const key = makeStateKey<FindResult<TestPost>>('mcms:posts:find');
		transferState.set(key, cachedResult);

		const postsApi = api.collection<TestPost>('posts');

		postsApi.find$({ transfer: false }).subscribe();

		// Should make HTTP request despite cache being available
		const req = httpMock.expectOne('/api/posts');
		req.flush({ docs: [], totalDocs: 0 });
	});

	it('should make HTTP request when TransferState has no cached data', () => {
		const postsApi = api.collection<TestPost>('posts');

		postsApi.find$().subscribe();

		// Should make HTTP request since no cache
		const req = httpMock.expectOne('/api/posts');
		req.flush({ docs: [mockPost], totalDocs: 1 });
	});

	it('should use TransferState cache for findById$', () => {
		const key = makeStateKey<TestPost | null>('mcms:posts:findById:post-1');
		transferState.set(key, mockPost);

		const postsApi = api.collection<TestPost>('posts');

		postsApi.findById$('post-1').subscribe((result) => {
			expect(result).toEqual(mockPost);
		});

		httpMock.expectNone('/api/posts/post-1');
	});

	it('should skip TransferState for findById$ when transfer: false', () => {
		const key = makeStateKey<TestPost | null>('mcms:posts:findById:post-1');
		transferState.set(key, mockPost);

		const postsApi = api.collection<TestPost>('posts');

		postsApi.findById$('post-1', { transfer: false }).subscribe();

		const req = httpMock.expectOne('/api/posts/post-1');
		req.flush({ doc: mockPost });
	});

	it('should include option hash in TransferState key for find$ with options', () => {
		// The key includes a base64 hash of the sorted options (excluding transfer)
		const options = { limit: 5, page: 2 };
		const hashParts: Record<string, unknown> = { limit: 5, page: 2 };
		const sortedKeys = Object.keys(hashParts).sort();
		const sorted: Record<string, unknown> = {};
		for (const k of sortedKeys) {
			sorted[k] = hashParts[k];
		}
		const hash = btoa(JSON.stringify(sorted)).slice(0, 16);
		const key = makeStateKey<FindResult<TestPost>>(`mcms:posts:find:${hash}`);

		const cachedResult: FindResult<TestPost> = {
			docs: [mockPost],
			totalDocs: 1,
			totalPages: 1,
			page: 2,
			limit: 5,
			hasNextPage: false,
			hasPrevPage: true,
			prevPage: 1,
		};

		transferState.set(key, cachedResult);

		const postsApi = api.collection<TestPost>('posts');

		postsApi.find$(options).subscribe((result) => {
			expect(result).toEqual(cachedResult);
		});

		httpMock.expectNone('/api/posts');
	});
});

// ============================================
// generateTransferKey Stability Tests
// ============================================

describe('TransferState key stability', () => {
	let api: MomentumClientAPI;
	let httpMock: HttpTestingController;
	let transferState: TransferState;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				TransferState,
			],
		});

		api = TestBed.runInInjectionContext(() => injectMomentumAPI());
		httpMock = TestBed.inject(HttpTestingController);
		transferState = TestBed.inject(TransferState);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('should produce the same key regardless of option insertion order', () => {
		// Two equivalent options objects with different key orders should produce the same key
		// We verify this by caching with one key format and expecting a hit
		const sortedHash = btoa(JSON.stringify({ depth: 2, limit: 10 })).slice(0, 16);
		const key = makeStateKey<FindResult<TestPost>>(`mcms:posts:find:${sortedHash}`);

		const cachedResult: FindResult<TestPost> = {
			docs: [mockPost],
			totalDocs: 1,
			totalPages: 1,
			page: 1,
			limit: 10,
			hasNextPage: false,
			hasPrevPage: false,
		};

		transferState.set(key, cachedResult);

		const postsApi = api.collection<TestPost>('posts');

		// Pass options with depth before limit - keys are sorted, so the hash should be the same
		postsApi.find$({ depth: 2, limit: 10 }).subscribe((result) => {
			expect(result).toEqual(cachedResult);
		});

		httpMock.expectNone('/api/posts');
	});

	it('should produce a key without hash part when no options are provided', () => {
		const key = makeStateKey<FindResult<TestPost>>('mcms:posts:find');
		const cachedResult: FindResult<TestPost> = {
			docs: [],
			totalDocs: 0,
			totalPages: 1,
			page: 1,
			limit: 10,
			hasNextPage: false,
			hasPrevPage: false,
		};

		transferState.set(key, cachedResult);

		const postsApi = api.collection<TestPost>('posts');
		postsApi.find$().subscribe((result) => {
			expect(result).toEqual(cachedResult);
		});

		httpMock.expectNone('/api/posts');
	});

	it('should include id in findById transfer key', () => {
		const key = makeStateKey<TestPost | null>('mcms:posts:findById:post-1');
		transferState.set(key, mockPost);

		const postsApi = api.collection<TestPost>('posts');
		postsApi.findById$('post-1').subscribe((result) => {
			expect(result).toEqual(mockPost);
		});

		httpMock.expectNone('/api/posts/post-1');
	});

	it('should produce different keys for different IDs in findById', () => {
		const key1 = makeStateKey<TestPost | null>('mcms:posts:findById:post-1');
		transferState.set(key1, mockPost);

		const postsApi = api.collection<TestPost>('posts');

		// Requesting post-2 should NOT hit the post-1 cache
		postsApi.findById$('post-2').subscribe();

		const req = httpMock.expectOne('/api/posts/post-2');
		req.flush({ doc: mockPost2 });
	});

	it('should produce different keys for different collections', () => {
		const key = makeStateKey<FindResult<TestPost>>('mcms:posts:find');
		const cachedResult: FindResult<TestPost> = {
			docs: [mockPost],
			totalDocs: 1,
			totalPages: 1,
			page: 1,
			limit: 10,
			hasNextPage: false,
			hasPrevPage: false,
		};

		transferState.set(key, cachedResult);

		// Requesting a different collection should NOT hit the posts cache
		const usersApi = api.collection('users');
		usersApi.find$().subscribe();

		const req = httpMock.expectOne('/api/users');
		req.flush({ docs: [], totalDocs: 0 });
	});
});

// ============================================
// Signal Methods
// ============================================

describe('MomentumAPI - Signal Methods', () => {
	let api: MomentumClientAPI;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
			],
		});

		api = TestBed.runInInjectionContext(() => injectMomentumAPI());
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('findSignal should return a signal that starts as undefined', () => {
		const postsApi = api.collection<TestPost>('posts');

		const result = TestBed.runInInjectionContext(() => postsApi.findSignal());

		expect(result()).toBeUndefined();

		const req = httpMock.expectOne('/api/posts');
		req.flush({ docs: [mockPost], totalDocs: 1 });
	});

	it('findByIdSignal should return a signal that starts as undefined', () => {
		const postsApi = api.collection<TestPost>('posts');

		const result = TestBed.runInInjectionContext(() => postsApi.findByIdSignal('post-1'));

		expect(result()).toBeUndefined();

		const req = httpMock.expectOne('/api/posts/post-1');
		req.flush({ doc: mockPost });
	});
});

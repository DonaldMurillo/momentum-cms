/**
 * Extended tests for MomentumAPI covering provideMomentumAPI, createTypedProxy,
 * ServerMomentumAPI, and additional BrowserCollectionAPI edge cases.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
	injectMomentumAPI,
	injectTypedMomentumAPI,
	provideMomentumAPI,
	MOMENTUM_API,
	MOMENTUM_API_CONTEXT,
	type MomentumClientAPI,
	type MomentumAPIServer,
	type MomentumAPIContext,
} from '../momentum-api.service';

interface TestPost {
	id: string;
	title: string;
}

const mockPost: TestPost = { id: 'p1', title: 'Test Post' };

// ============================================
// provideMomentumAPI
// ============================================

describe('provideMomentumAPI', () => {
	it('should create providers with API and context', () => {
		const mockApi = { collection: vi.fn(), global: vi.fn() } as unknown as MomentumAPIServer;
		const context: MomentumAPIContext = { user: { id: '1', email: 'test@test.com' } };

		const providers = provideMomentumAPI(mockApi, context);

		expect(providers).toHaveLength(2);
		expect(providers).toContainEqual({ provide: MOMENTUM_API, useValue: mockApi });
		expect(providers).toContainEqual({ provide: MOMENTUM_API_CONTEXT, useValue: context });
	});

	it('should default context to empty object when not provided', () => {
		const mockApi = { collection: vi.fn(), global: vi.fn() } as unknown as MomentumAPIServer;

		const providers = provideMomentumAPI(mockApi);

		expect(providers).toContainEqual({ provide: MOMENTUM_API_CONTEXT, useValue: {} });
	});
});

// ============================================
// injectTypedMomentumAPI
// ============================================

describe('injectTypedMomentumAPI', () => {
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
			],
		});

		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('should return a proxy that wraps the base API', () => {
		interface TypedCollections {
			[key: string]: { doc: unknown; where?: unknown };
			posts: { doc: TestPost };
		}

		const api = TestBed.runInInjectionContext(() => injectTypedMomentumAPI<TypedCollections>());

		expect(api.posts).toBeDefined();
		expect(api.posts.find$).toBeDefined();
	});

	it('should support collection() method on typed proxy', () => {
		interface TypedCollections {
			[key: string]: { doc: unknown; where?: unknown };
			posts: { doc: TestPost };
		}

		const api = TestBed.runInInjectionContext(() => injectTypedMomentumAPI<TypedCollections>());

		const postsApi = api.collection('posts');
		expect(postsApi).toBeDefined();
		expect(postsApi.find$).toBeDefined();
	});

	it('should make HTTP calls through the proxy', () => {
		interface TypedCollections {
			[key: string]: { doc: unknown; where?: unknown };
			posts: { doc: TestPost };
		}

		const api = TestBed.runInInjectionContext(() => injectTypedMomentumAPI<TypedCollections>());

		api.posts.find$().subscribe();

		const req = httpMock.expectOne('/api/posts');
		expect(req.request.method).toBe('GET');
		req.flush({ docs: [mockPost], totalDocs: 1 });
	});
});

// ============================================
// Server-side API (SSR context)
// ============================================

describe('injectMomentumAPI - Server Context', () => {
	it('should use server API when available', () => {
		const mockCollectionOps = {
			find: vi.fn().mockResolvedValue({ docs: [mockPost], totalDocs: 1, totalPages: 1 }),
			findById: vi.fn().mockResolvedValue(mockPost),
			create: vi.fn().mockResolvedValue(mockPost),
			update: vi.fn().mockResolvedValue(mockPost),
			delete: vi.fn().mockResolvedValue({ id: 'p1', deleted: true }),
			forceDelete: vi.fn().mockResolvedValue({ id: 'p1', deleted: true }),
			restore: vi.fn().mockResolvedValue(mockPost),
			count: vi.fn().mockResolvedValue(1),
			batchCreate: vi.fn().mockResolvedValue([mockPost]),
			batchUpdate: vi.fn().mockResolvedValue([mockPost]),
			batchDelete: vi.fn().mockResolvedValue([{ id: 'p1', deleted: true }]),
		};

		const mockGlobalOps = {
			findOne: vi.fn().mockResolvedValue({ siteName: 'Test' }),
			update: vi.fn().mockResolvedValue({ siteName: 'Updated' }),
		};

		const mockServerApi: MomentumAPIServer = {
			collection: vi.fn().mockReturnValue(mockCollectionOps),
			global: vi.fn().mockReturnValue(mockGlobalOps),
			getConfig: vi.fn(),
			setContext: vi.fn().mockReturnThis(),
			getContext: vi.fn().mockReturnValue({}),
		};

		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'server' },
				{ provide: MOMENTUM_API, useValue: mockServerApi },
				{ provide: MOMENTUM_API_CONTEXT, useValue: {} },
			],
		});

		const api = TestBed.runInInjectionContext(() => injectMomentumAPI());
		expect(api).toBeDefined();
	});

	it('should set context when user is provided', () => {
		const mockServerApi: MomentumAPIServer = {
			collection: vi.fn(),
			global: vi.fn(),
			getConfig: vi.fn(),
			setContext: vi.fn().mockReturnThis(),
			getContext: vi.fn().mockReturnValue({}),
		};

		const context: MomentumAPIContext = { user: { id: '1' } };

		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'server' },
				{ provide: MOMENTUM_API, useValue: mockServerApi },
				{ provide: MOMENTUM_API_CONTEXT, useValue: context },
			],
		});

		TestBed.runInInjectionContext(() => injectMomentumAPI());
		expect(mockServerApi.setContext).toHaveBeenCalledWith(context);
	});

	it('should fallback to HTTP when no server API (prerendering)', () => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'server' },
			],
		});

		const api = TestBed.runInInjectionContext(() => injectMomentumAPI());
		expect(api).toBeDefined();
		expect(api.collection).toBeDefined();
	});
});

// ============================================
// Server Collection API
// ============================================

describe('ServerCollectionAPI', () => {
	let api: MomentumClientAPI;
	let mockCollectionOps: Record<string, ReturnType<typeof vi.fn>>;
	let mockGlobalOps: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		mockCollectionOps = {
			find: vi.fn().mockResolvedValue({
				docs: [mockPost],
				totalDocs: 1,
				totalPages: 1,
				page: 1,
				limit: 10,
				hasNextPage: false,
				hasPrevPage: false,
			}),
			findById: vi.fn().mockResolvedValue(mockPost),
			create: vi.fn().mockResolvedValue(mockPost),
			update: vi.fn().mockResolvedValue(mockPost),
			delete: vi.fn().mockResolvedValue({ id: 'p1', deleted: true }),
			forceDelete: vi.fn().mockResolvedValue({ id: 'p1', deleted: true }),
			restore: vi.fn().mockResolvedValue(mockPost),
			count: vi.fn().mockResolvedValue(1),
			batchCreate: vi.fn().mockResolvedValue([mockPost]),
			batchUpdate: vi.fn().mockResolvedValue([mockPost]),
			batchDelete: vi.fn().mockResolvedValue([{ id: 'p1', deleted: true }]),
		};

		mockGlobalOps = {
			findOne: vi.fn().mockResolvedValue({ siteName: 'Test' }),
			update: vi.fn().mockResolvedValue({ siteName: 'Updated' }),
		};

		const mockServerApi: MomentumAPIServer = {
			collection: vi.fn().mockReturnValue(mockCollectionOps),
			global: vi.fn().mockReturnValue(mockGlobalOps),
			getConfig: vi.fn(),
			setContext: vi.fn().mockReturnThis(),
			getContext: vi.fn().mockReturnValue({}),
		};

		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'server' },
				{ provide: MOMENTUM_API, useValue: mockServerApi },
				{ provide: MOMENTUM_API_CONTEXT, useValue: {} },
			],
		});

		api = TestBed.runInInjectionContext(() => injectMomentumAPI());
	});

	describe('Observable methods', () => {
		it('find$ should return observable from server ops', async () => {
			const result = await firstValueFrom(api.collection<TestPost>('posts').find$());
			expect(result.docs).toEqual([mockPost]);
		});

		it('findById$ should return observable', async () => {
			const result = await firstValueFrom(api.collection<TestPost>('posts').findById$('p1'));
			expect(result).toEqual(mockPost);
		});

		it('create$ should return observable', async () => {
			const result = await firstValueFrom(
				api.collection<TestPost>('posts').create$({ title: 'New' }),
			);
			expect(result).toEqual(mockPost);
		});

		it('update$ should return observable', async () => {
			const result = await firstValueFrom(
				api.collection<TestPost>('posts').update$('p1', { title: 'Updated' }),
			);
			expect(result).toEqual(mockPost);
		});

		it('delete$ should return observable', async () => {
			const result = await firstValueFrom(api.collection<TestPost>('posts').delete$('p1'));
			expect(result).toEqual({ id: 'p1', deleted: true });
		});

		it('forceDelete$ should return observable', async () => {
			const result = await firstValueFrom(api.collection<TestPost>('posts').forceDelete$('p1'));
			expect(result).toEqual({ id: 'p1', deleted: true });
		});

		it('restore$ should return observable', async () => {
			const result = await firstValueFrom(api.collection<TestPost>('posts').restore$('p1'));
			expect(result).toEqual(mockPost);
		});

		it('batchCreate$ should return observable', async () => {
			const result = await firstValueFrom(
				api.collection<TestPost>('posts').batchCreate$([{ title: 'New' }]),
			);
			expect(result).toEqual([mockPost]);
		});

		it('batchUpdate$ should return observable', async () => {
			const result = await firstValueFrom(
				api.collection<TestPost>('posts').batchUpdate$([{ id: 'p1', data: { title: 'Updated' } }]),
			);
			expect(result).toEqual([mockPost]);
		});

		it('batchDelete$ should return observable', async () => {
			const result = await firstValueFrom(api.collection<TestPost>('posts').batchDelete$(['p1']));
			expect(result).toEqual([{ id: 'p1', deleted: true }]);
		});
	});

	describe('Observable error handling', () => {
		it('find$ should propagate errors', async () => {
			mockCollectionOps['find'].mockRejectedValue(new Error('Server error'));
			await expect(firstValueFrom(api.collection<TestPost>('posts').find$())).rejects.toThrow(
				'Server error',
			);
		});

		it('findById$ should propagate errors', async () => {
			mockCollectionOps['findById'].mockRejectedValue(new Error('Not found'));
			await expect(
				firstValueFrom(api.collection<TestPost>('posts').findById$('p1')),
			).rejects.toThrow('Not found');
		});

		it('create$ should propagate errors', async () => {
			mockCollectionOps['create'].mockRejectedValue(new Error('Validation error'));
			await expect(
				firstValueFrom(api.collection<TestPost>('posts').create$({ title: 'New' })),
			).rejects.toThrow('Validation error');
		});

		it('update$ should propagate errors', async () => {
			mockCollectionOps['update'].mockRejectedValue(new Error('Update failed'));
			await expect(
				firstValueFrom(api.collection<TestPost>('posts').update$('p1', { title: 'Updated' })),
			).rejects.toThrow('Update failed');
		});

		it('delete$ should propagate errors', async () => {
			mockCollectionOps['delete'].mockRejectedValue(new Error('Delete failed'));
			await expect(firstValueFrom(api.collection<TestPost>('posts').delete$('p1'))).rejects.toThrow(
				'Delete failed',
			);
		});

		it('forceDelete$ should propagate errors', async () => {
			mockCollectionOps['forceDelete'].mockRejectedValue(new Error('Force delete failed'));
			await expect(
				firstValueFrom(api.collection<TestPost>('posts').forceDelete$('p1')),
			).rejects.toThrow('Force delete failed');
		});

		it('restore$ should propagate errors', async () => {
			mockCollectionOps['restore'].mockRejectedValue(new Error('Restore failed'));
			await expect(
				firstValueFrom(api.collection<TestPost>('posts').restore$('p1')),
			).rejects.toThrow('Restore failed');
		});

		it('batchCreate$ should propagate errors', async () => {
			mockCollectionOps['batchCreate'].mockRejectedValue(new Error('Batch create failed'));
			await expect(
				firstValueFrom(api.collection<TestPost>('posts').batchCreate$([{ title: 'New' }])),
			).rejects.toThrow('Batch create failed');
		});

		it('batchUpdate$ should propagate errors', async () => {
			mockCollectionOps['batchUpdate'].mockRejectedValue(new Error('Batch update failed'));
			await expect(
				firstValueFrom(
					api
						.collection<TestPost>('posts')
						.batchUpdate$([{ id: 'p1', data: { title: 'Updated' } }]),
				),
			).rejects.toThrow('Batch update failed');
		});

		it('batchDelete$ should propagate errors', async () => {
			mockCollectionOps['batchDelete'].mockRejectedValue(new Error('Batch delete failed'));
			await expect(
				firstValueFrom(api.collection<TestPost>('posts').batchDelete$(['p1'])),
			).rejects.toThrow('Batch delete failed');
		});
	});

	describe('Promise methods', () => {
		it('find should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').find();
			expect(result.docs).toEqual([mockPost]);
		});

		it('findById should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').findById('p1');
			expect(result).toEqual(mockPost);
		});

		it('create should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').create({ title: 'New' });
			expect(result).toEqual(mockPost);
		});

		it('update should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').update('p1', { title: 'Updated' });
			expect(result).toEqual(mockPost);
		});

		it('delete should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').delete('p1');
			expect(result).toEqual({ id: 'p1', deleted: true });
		});

		it('forceDelete should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').forceDelete('p1');
			expect(result).toEqual({ id: 'p1', deleted: true });
		});

		it('restore should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').restore('p1');
			expect(result).toEqual(mockPost);
		});

		it('batchCreate should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').batchCreate([{ title: 'New' }]);
			expect(result).toEqual([mockPost]);
		});

		it('batchUpdate should delegate to server ops', async () => {
			const result = await api
				.collection<TestPost>('posts')
				.batchUpdate([{ id: 'p1', data: { title: 'Updated' } }]);
			expect(result).toEqual([mockPost]);
		});

		it('batchDelete should delegate to server ops', async () => {
			const result = await api.collection<TestPost>('posts').batchDelete(['p1']);
			expect(result).toEqual([{ id: 'p1', deleted: true }]);
		});
	});

	describe('Signal methods', () => {
		it('findSignal should return a signal', () => {
			const postsApi = api.collection<TestPost>('posts');
			const sig = postsApi.findSignal();
			expect(sig()).toBeUndefined();
		});

		it('findByIdSignal should return a signal', () => {
			const postsApi = api.collection<TestPost>('posts');
			const sig = postsApi.findByIdSignal('p1');
			expect(sig()).toBeUndefined();
		});
	});

	describe('Global API', () => {
		it('findOne$ should return observable', async () => {
			const result = await firstValueFrom(api.global<{ siteName: string }>('settings').findOne$());
			expect(result).toEqual({ siteName: 'Test' });
		});

		it('update$ should return observable', async () => {
			const result = await firstValueFrom(
				api.global<{ siteName: string }>('settings').update$({ siteName: 'Updated' }),
			);
			expect(result).toEqual({ siteName: 'Updated' });
		});

		it('findOne should return promise', async () => {
			const result = await api.global<{ siteName: string }>('settings').findOne();
			expect(result).toEqual({ siteName: 'Test' });
		});

		it('update should return promise', async () => {
			const result = await api.global<{ siteName: string }>('settings').update({
				siteName: 'Updated',
			});
			expect(result).toEqual({ siteName: 'Updated' });
		});

		it('findOne$ should propagate errors', async () => {
			mockGlobalOps['findOne'].mockRejectedValue(new Error('Global error'));
			await expect(firstValueFrom(api.global('settings').findOne$())).rejects.toThrow(
				'Global error',
			);
		});

		it('update$ should propagate errors', async () => {
			mockGlobalOps['update'].mockRejectedValue(new Error('Update error'));
			await expect(
				firstValueFrom(api.global('settings').update$({ siteName: 'Fail' })),
			).rejects.toThrow('Update error');
		});

		it('findOne$ with options should pass through', async () => {
			const result = await firstValueFrom(
				api.global<{ siteName: string }>('settings').findOne$({ depth: 2 }),
			);
			expect(result).toEqual({ siteName: 'Test' });
			expect(mockGlobalOps['findOne']).toHaveBeenCalledWith({ depth: 2 });
		});
	});
});

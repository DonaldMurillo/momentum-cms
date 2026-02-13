/**
 * Collection Access Service Unit Tests
 *
 * Tests the real CollectionAccessService using TestBed and HttpTestingController.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CollectionAccessService } from '../../lib/services/collection-access.service';

describe('CollectionAccessService', () => {
	let service: CollectionAccessService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [CollectionAccessService, provideHttpClient(), provideHttpClientTesting()],
		});

		service = TestBed.inject(CollectionAccessService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	describe('initial state', () => {
		it('should start with loading=true', () => {
			expect(service.loading()).toBe(true);
		});

		it('should start with initialized=false', () => {
			expect(service.initialized()).toBe(false);
		});

		it('should start with empty permissions', () => {
			expect(service.permissions()).toEqual([]);
		});

		it('should start with no error', () => {
			expect(service.error()).toBeNull();
		});
	});

	describe('loadAccess()', () => {
		it('should fetch permissions from /api/access and update signals', async () => {
			const loadPromise = service.loadAccess();

			const req = httpMock.expectOne('/api/access');
			expect(req.request.method).toBe('GET');
			req.flush({
				collections: [
					{
						slug: 'posts',
						canAccess: true,
						canCreate: true,
						canRead: true,
						canUpdate: true,
						canDelete: false,
					},
					{
						slug: 'users',
						canAccess: false,
						canCreate: false,
						canRead: false,
						canUpdate: false,
						canDelete: false,
					},
				],
			});

			await loadPromise;

			expect(service.initialized()).toBe(true);
			expect(service.loading()).toBe(false);
			expect(service.permissions()).toHaveLength(2);
		});

		it('should compute accessibleCollections from response', async () => {
			const loadPromise = service.loadAccess();

			const req = httpMock.expectOne('/api/access');
			req.flush({
				collections: [
					{
						slug: 'posts',
						canAccess: true,
						canCreate: true,
						canRead: true,
						canUpdate: true,
						canDelete: true,
					},
					{
						slug: 'users',
						canAccess: false,
						canCreate: false,
						canRead: false,
						canUpdate: false,
						canDelete: false,
					},
					{
						slug: 'articles',
						canAccess: true,
						canCreate: true,
						canRead: true,
						canUpdate: true,
						canDelete: true,
					},
				],
			});

			await loadPromise;

			expect(service.accessibleCollections()).toEqual(['posts', 'articles']);
		});

		it('should handle error and set empty permissions', async () => {
			const loadPromise = service.loadAccess();

			const req = httpMock.expectOne('/api/access');
			req.error(new ErrorEvent('Network error'));

			await loadPromise;

			expect(service.error()).toBe('Failed to load collection permissions');
			expect(service.permissions()).toEqual([]);
			expect(service.loading()).toBe(false);
		});

		it('should deduplicate concurrent calls', async () => {
			const promise1 = service.loadAccess();
			const promise2 = service.loadAccess();

			// Only one HTTP request should be made
			const req = httpMock.expectOne('/api/access');
			req.flush({ collections: [] });

			await Promise.all([promise1, promise2]);
			expect(service.initialized()).toBe(true);
		});
	});

	describe('permission checks', () => {
		beforeEach(async () => {
			const loadPromise = service.loadAccess();
			const req = httpMock.expectOne('/api/access');
			req.flush({
				collections: [
					{
						slug: 'posts',
						canAccess: true,
						canCreate: true,
						canRead: true,
						canUpdate: true,
						canDelete: false,
					},
				],
			});
			await loadPromise;
		});

		it('canAccess() should return true for accessible collection', () => {
			expect(service.canAccess('posts')).toBe(true);
		});

		it('canAccess() should return false for unknown collection', () => {
			expect(service.canAccess('unknown')).toBe(false);
		});

		it('canCreate() should return correct value', () => {
			expect(service.canCreate('posts')).toBe(true);
		});

		it('canRead() should return correct value', () => {
			expect(service.canRead('posts')).toBe(true);
		});

		it('canUpdate() should return correct value', () => {
			expect(service.canUpdate('posts')).toBe(true);
		});

		it('canDelete() should return correct value', () => {
			expect(service.canDelete('posts')).toBe(false);
		});

		it('getPermissions() should return full permissions for known collection', () => {
			const perms = service.getPermissions('posts');
			expect(perms).toEqual({
				slug: 'posts',
				canAccess: true,
				canCreate: true,
				canRead: true,
				canUpdate: true,
				canDelete: false,
			});
		});

		it('getPermissions() should return undefined for unknown collection', () => {
			expect(service.getPermissions('unknown')).toBeUndefined();
		});
	});

	describe('reset()', () => {
		it('should clear all state', async () => {
			// First load some data
			const loadPromise = service.loadAccess();
			const req = httpMock.expectOne('/api/access');
			req.flush({
				collections: [
					{
						slug: 'posts',
						canAccess: true,
						canCreate: true,
						canRead: true,
						canUpdate: true,
						canDelete: true,
					},
				],
			});
			await loadPromise;

			expect(service.initialized()).toBe(true);
			expect(service.permissions()).toHaveLength(1);

			// Reset
			service.reset();

			expect(service.initialized()).toBe(false);
			expect(service.permissions()).toEqual([]);
			expect(service.error()).toBeNull();
		});
	});
});

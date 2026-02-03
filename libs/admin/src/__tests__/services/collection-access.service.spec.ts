/**
 * Collection Access Service Unit Tests
 *
 * Tests the core collection access logic in isolation.
 * Full integration testing is done via E2E tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed } from '@angular/core';

// Test the core access logic in isolation without Angular DI
describe('CollectionAccessService Logic', () => {
	// Simulated service state
	interface CollectionPermissions {
		slug: string;
		canAccess: boolean;
		canCreate: boolean;
		canRead: boolean;
		canUpdate: boolean;
		canDelete: boolean;
	}

	const createMockService = (): {
		_permissions: ReturnType<typeof signal<CollectionPermissions[]>>;
		loading: ReturnType<typeof signal<boolean>>;
		initialized: ReturnType<typeof signal<boolean>>;
		error: ReturnType<typeof signal<string | null>>;
		permissions: ReturnType<typeof computed<CollectionPermissions[]>>;
		accessibleCollections: ReturnType<typeof computed<string[]>>;
		canAccess: (slug: string) => boolean;
		canCreate: (slug: string) => boolean;
		canRead: (slug: string) => boolean;
		canUpdate: (slug: string) => boolean;
		canDelete: (slug: string) => boolean;
		getPermissions: (slug: string) => CollectionPermissions | undefined;
		reset: () => void;
	} => {
		const _permissions = signal<CollectionPermissions[]>([]);
		const loading = signal(true);
		const initialized = signal(false);
		const error = signal<string | null>(null);

		const permissions = computed(() => _permissions());
		const accessibleCollections = computed(() =>
			_permissions()
				.filter((p) => p.canAccess)
				.map((p) => p.slug),
		);

		const getPermissions = (slug: string): CollectionPermissions | undefined =>
			_permissions().find((p) => p.slug === slug);

		const canAccess = (slug: string): boolean => getPermissions(slug)?.canAccess ?? false;
		const canCreate = (slug: string): boolean => getPermissions(slug)?.canCreate ?? false;
		const canRead = (slug: string): boolean => getPermissions(slug)?.canRead ?? false;
		const canUpdate = (slug: string): boolean => getPermissions(slug)?.canUpdate ?? false;
		const canDelete = (slug: string): boolean => getPermissions(slug)?.canDelete ?? false;

		const reset = (): void => {
			_permissions.set([]);
			initialized.set(false);
			error.set(null);
		};

		return {
			_permissions,
			loading,
			initialized,
			error,
			permissions,
			accessibleCollections,
			canAccess,
			canCreate,
			canRead,
			canUpdate,
			canDelete,
			getPermissions,
			reset,
		};
	};

	describe('initial state', () => {
		it('should start with loading=true', () => {
			const service = createMockService();
			expect(service.loading()).toBe(true);
		});

		it('should start with initialized=false', () => {
			const service = createMockService();
			expect(service.initialized()).toBe(false);
		});

		it('should start with empty permissions', () => {
			const service = createMockService();
			expect(service.permissions()).toEqual([]);
		});

		it('should start with no error', () => {
			const service = createMockService();
			expect(service.error()).toBeNull();
		});
	});

	describe('permissions loading', () => {
		it('should update signals after loading permissions', () => {
			const service = createMockService();

			const mockPermissions: CollectionPermissions[] = [
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
			];

			// Simulate successful load
			service._permissions.set(mockPermissions);
			service.initialized.set(true);
			service.loading.set(false);

			expect(service.permissions()).toEqual(mockPermissions);
			expect(service.initialized()).toBe(true);
			expect(service.loading()).toBe(false);
		});

		it('should compute accessibleCollections correctly', () => {
			const service = createMockService();

			service._permissions.set([
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
				{
					slug: 'articles',
					canAccess: true,
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: true,
				},
			]);

			expect(service.accessibleCollections()).toEqual(['posts', 'articles']);
		});

		it('should handle error state', () => {
			const service = createMockService();

			// Simulate error
			service.error.set('Failed to load permissions');
			service._permissions.set([]);
			service.loading.set(false);

			expect(service.error()).toBe('Failed to load permissions');
			expect(service.permissions()).toEqual([]);
		});
	});

	describe('canAccess()', () => {
		it('should return true for accessible collection', () => {
			const service = createMockService();
			service._permissions.set([
				{
					slug: 'posts',
					canAccess: true,
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: true,
				},
			]);

			expect(service.canAccess('posts')).toBe(true);
		});

		it('should return false for inaccessible collection', () => {
			const service = createMockService();
			service._permissions.set([
				{
					slug: 'users',
					canAccess: false,
					canCreate: false,
					canRead: false,
					canUpdate: false,
					canDelete: false,
				},
			]);

			expect(service.canAccess('users')).toBe(false);
		});

		it('should return false for unknown collection', () => {
			const service = createMockService();
			service._permissions.set([
				{
					slug: 'posts',
					canAccess: true,
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: true,
				},
			]);

			expect(service.canAccess('unknown')).toBe(false);
		});
	});

	describe('individual permission checks', () => {
		let service: ReturnType<typeof createMockService>;

		beforeEach(() => {
			service = createMockService();
			service._permissions.set([
				{
					slug: 'posts',
					canAccess: true,
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: false,
				},
			]);
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
	});

	describe('getPermissions()', () => {
		it('should return full permissions for known collection', () => {
			const service = createMockService();
			const expectedPerms: CollectionPermissions = {
				slug: 'posts',
				canAccess: true,
				canCreate: true,
				canRead: true,
				canUpdate: true,
				canDelete: false,
			};
			service._permissions.set([expectedPerms]);

			expect(service.getPermissions('posts')).toEqual(expectedPerms);
		});

		it('should return undefined for unknown collection', () => {
			const service = createMockService();
			service._permissions.set([
				{
					slug: 'posts',
					canAccess: true,
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: true,
				},
			]);

			expect(service.getPermissions('unknown')).toBeUndefined();
		});
	});

	describe('reset()', () => {
		it('should clear all state', () => {
			const service = createMockService();

			// Set some state
			service._permissions.set([
				{
					slug: 'posts',
					canAccess: true,
					canCreate: true,
					canRead: true,
					canUpdate: true,
					canDelete: true,
				},
			]);
			service.initialized.set(true);
			service.error.set('some error');

			// Reset
			service.reset();

			expect(service.initialized()).toBe(false);
			expect(service.permissions()).toEqual([]);
			expect(service.error()).toBeNull();
		});
	});
});

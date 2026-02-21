import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import type { CollectionConfig, Field } from '@momentumcms/core';
import { EntityViewWidget } from '../entity-view.component';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { MOMENTUM_API, MOMENTUM_API_CONTEXT } from '../../../services/momentum-api.service';

// ---- helpers ----

class MockCollectionAccessService {
	canUpdate = vi.fn().mockReturnValue(true);
	canDelete = vi.fn().mockReturnValue(true);
}

class MockFeedbackService {
	confirmDelete = vi.fn().mockResolvedValue(true);
	confirmBulkDelete = vi.fn().mockResolvedValue(true);
	entityNotFound = vi.fn();
	operationFailed = vi.fn();
}

function createMockCollection(overrides: Partial<CollectionConfig> = {}): CollectionConfig {
	return {
		slug: 'posts',
		labels: { singular: 'Post', plural: 'Posts' },
		fields: [{ name: 'title', type: 'text' } as Field, { name: 'email', type: 'email' } as Field],
		timestamps: true,
		...overrides,
	};
}

function createMockApi(): {
	api: Record<string, unknown>;
	mockCollection: Record<string, ReturnType<typeof vi.fn>>;
} {
	const mockCol = {
		find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 1 }),
		findById: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockResolvedValue({ id: '1' }),
		update: vi.fn().mockResolvedValue({ id: '1' }),
		delete: vi.fn().mockResolvedValue({ id: '1', deleted: true }),
		forceDelete: vi.fn().mockResolvedValue({ id: '1', deleted: true }),
		restore: vi.fn().mockResolvedValue({ id: '1' }),
		batchDelete: vi.fn().mockResolvedValue([]),
	};

	const api = {
		collection: vi.fn().mockReturnValue(mockCol),
		global: vi.fn().mockReturnValue({ find: vi.fn(), update: vi.fn() }),
		getConfig: vi.fn().mockReturnValue({ collections: [] }),
		setContext: vi.fn(),
		getContext: vi.fn().mockReturnValue({}),
	};

	return { api, mockCollection: mockCol };
}

// ---- tests ----

describe('EntityViewWidget - extended coverage', () => {
	let fixture: ComponentFixture<EntityViewWidget>;
	let component: EntityViewWidget;
	let mockAccess: MockCollectionAccessService;
	let mockFeedback: MockFeedbackService;
	let router: Router;
	let apiMock: ReturnType<typeof createMockApi>;

	beforeEach(async () => {
		mockAccess = new MockCollectionAccessService();
		mockFeedback = new MockFeedbackService();
		apiMock = createMockApi();

		await TestBed.configureTestingModule({
			imports: [EntityViewWidget],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'server' },
				{ provide: CollectionAccessService, useValue: mockAccess },
				{ provide: FeedbackService, useValue: mockFeedback },
				{ provide: MOMENTUM_API, useValue: apiMock.api },
				{ provide: MOMENTUM_API_CONTEXT, useValue: {} },
			],
		})
			.overrideComponent(EntityViewWidget, {
				set: { imports: [], template: '<div></div>' },
			})
			.compileComponents();

		fixture = TestBed.createComponent(EntityViewWidget);
		component = fixture.componentInstance;
		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
	});

	// ------------------------------------------------------------------
	// resolveRelationships (L653-721) — relationship resolution
	// ------------------------------------------------------------------
	describe('resolveRelationships via loadEntity', () => {
		it('should resolve relationship fields from API', async () => {
			const relCollection: CollectionConfig = {
				slug: 'users',
				fields: [{ name: 'name', type: 'text' } as Field],
				labels: { singular: 'User', plural: 'Users' },
			};

			const col = createMockCollection({
				fields: [
					{ name: 'title', type: 'text' } as Field,
					{
						name: 'author',
						type: 'relationship',
						collection: () => relCollection,
					} as unknown as Field,
				],
			});

			// Main entity lookup returns a doc with a raw string relationship value
			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				title: 'Test Post',
				author: 'user-1',
			});

			// Relationship resolution lookup
			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'user-1',
				name: 'Alice',
			});

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			// Wait for both loadEntity and resolveRelationships to complete
			await vi.waitFor(() => {
				expect(component.entity()).toBeTruthy();
			});

			await vi.waitFor(() => {
				expect(component.resolvedRelationships().size).toBeGreaterThan(0);
			});

			expect(component.resolvedRelationships().get('author')).toBe('Alice');
		});

		it('should fallback to id when title field is missing on relationship doc', async () => {
			const relCollection: CollectionConfig = {
				slug: 'categories',
				fields: [{ name: 'code', type: 'text' } as Field],
				labels: { singular: 'Category', plural: 'Categories' },
			};

			const col = createMockCollection({
				fields: [
					{
						name: 'category',
						type: 'relationship',
						collection: () => relCollection,
					} as unknown as Field,
				],
			});

			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				category: 'cat-1',
			});

			// Related doc has no title/name field, just an id
			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'cat-1',
				code: 'TECH',
			});

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.resolvedRelationships().size).toBeGreaterThan(0);
			});

			// titleField is 'id' so it should set String(doc['id'])
			expect(component.resolvedRelationships().get('category')).toBe('cat-1');
		});

		it('should set "Unknown" when relationship doc is not found', async () => {
			const relCollection: CollectionConfig = {
				slug: 'users',
				fields: [{ name: 'name', type: 'text' } as Field],
			};

			const col = createMockCollection({
				fields: [
					{
						name: 'author',
						type: 'relationship',
						collection: () => relCollection,
					} as unknown as Field,
				],
			});

			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				author: 'nonexistent-user',
			});
			apiMock.mockCollection['findById'].mockResolvedValueOnce(null);

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.resolvedRelationships().size).toBeGreaterThan(0);
			});

			expect(component.resolvedRelationships().get('author')).toBe('Unknown');
		});

		it('should set "Unknown" when relationship resolution throws', async () => {
			const relCollection: CollectionConfig = {
				slug: 'users',
				fields: [{ name: 'name', type: 'text' } as Field],
			};

			const col = createMockCollection({
				fields: [
					{
						name: 'author',
						type: 'relationship',
						collection: () => relCollection,
					} as unknown as Field,
				],
			});

			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				author: 'user-1',
			});
			apiMock.mockCollection['findById'].mockRejectedValueOnce(new Error('Network error'));

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.resolvedRelationships().size).toBeGreaterThan(0);
			});

			expect(component.resolvedRelationships().get('author')).toBe('Unknown');
		});

		it('should resolve upload fields with filename', async () => {
			const col = createMockCollection({
				fields: [
					{
						name: 'image',
						type: 'upload',
						relationTo: 'media',
					} as unknown as Field,
				],
			});

			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				image: 'media-1',
			});
			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'media-1',
				filename: 'photo.jpg',
			});

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.resolvedRelationships().size).toBeGreaterThan(0);
			});

			expect(component.resolvedRelationships().get('image')).toBe('photo.jpg');
		});

		it('should fallback to raw value when upload doc has no filename', async () => {
			const col = createMockCollection({
				fields: [
					{
						name: 'image',
						type: 'upload',
						relationTo: 'media',
					} as unknown as Field,
				],
			});

			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				image: 'media-1',
			});
			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'media-1',
			});

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.resolvedRelationships().size).toBeGreaterThan(0);
			});

			expect(component.resolvedRelationships().get('image')).toBe('media-1');
		});

		it('should fallback to raw value when upload resolution throws', async () => {
			const col = createMockCollection({
				fields: [
					{
						name: 'image',
						type: 'upload',
						relationTo: 'media',
					} as unknown as Field,
				],
			});

			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				image: 'media-1',
			});
			apiMock.mockCollection['findById'].mockRejectedValueOnce(new Error('fail'));

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.resolvedRelationships().size).toBeGreaterThan(0);
			});

			expect(component.resolvedRelationships().get('image')).toBe('media-1');
		});

		it('should skip relationship fields with non-string values', async () => {
			const relCollection: CollectionConfig = {
				slug: 'users',
				fields: [{ name: 'name', type: 'text' } as Field],
			};

			const col = createMockCollection({
				fields: [
					{
						name: 'author',
						type: 'relationship',
						collection: () => relCollection,
					} as unknown as Field,
				],
			});

			// author is already an object (populated), not a string
			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				author: { id: 'user-1', name: 'Alice' },
			});

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.entity()).toBeTruthy();
			});

			// No resolved relationships because the value wasn't a raw string ID
			expect(component.resolvedRelationships().size).toBe(0);
		});

		it('should skip relationship fields with invalid collection config', async () => {
			const col = createMockCollection({
				fields: [
					{
						name: 'author',
						type: 'relationship',
						collection: () => 'not-a-valid-config',
					} as unknown as Field,
				],
			});

			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				author: 'user-1',
			});

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.entity()).toBeTruthy();
			});

			// No resolved relationships because the collection() returned a string, not a config object
			expect(component.resolvedRelationships().size).toBe(0);
		});
	});

	// ------------------------------------------------------------------
	// loadEntity error paths
	// ------------------------------------------------------------------
	describe('loadEntity error handling', () => {
		it('should set loadError when entity not found', async () => {
			apiMock.mockCollection['findById'].mockResolvedValueOnce(null);

			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'nonexistent');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			expect(component.loadError()).toBe('Post not found');
			expect(mockFeedback.entityNotFound).toHaveBeenCalledWith('Post');
		});

		it('should set loadError when API throws', async () => {
			apiMock.mockCollection['findById'].mockRejectedValueOnce(new Error('Server error'));

			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			expect(component.loadError()).toBe('Failed to load data');
			expect(mockFeedback.operationFailed).toHaveBeenCalledWith('Load failed', expect.any(Error));
		});

		it('should handle non-Error thrown values', async () => {
			apiMock.mockCollection['findById'].mockRejectedValueOnce('string error');

			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});

			expect(component.loadError()).toBe('Failed to load data');
			expect(mockFeedback.operationFailed).toHaveBeenCalledWith('Load failed', undefined);
		});

		it('should load entity successfully and set state', async () => {
			const entity = { id: 'doc-1', title: 'Hello' };
			apiMock.mockCollection['findById'].mockResolvedValueOnce(entity);

			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.entity()).toBeTruthy();
			});

			expect(component.entity()).toEqual(entity);
			expect(component.isLoading()).toBe(false);
			expect(component.loadError()).toBeNull();
		});
	});

	// ------------------------------------------------------------------
	// onDeleteClick — confirmed path (L554-573)
	// ------------------------------------------------------------------
	describe('onDeleteClick - confirmed path', () => {
		it('should delete and navigate back on confirmed', async () => {
			const entity = { id: 'doc-1', title: 'Test Post' };
			component.entity.set(entity);
			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');

			mockFeedback.confirmDelete.mockResolvedValue(true);
			apiMock.mockCollection['delete'].mockResolvedValue({ id: 'doc-1', deleted: true });

			const emitted: unknown[] = [];
			component.delete_.subscribe((e) => emitted.push(e));

			await component.onDeleteClick();

			expect(mockFeedback.confirmDelete).toHaveBeenCalledWith('Post', 'Test Post');
			expect(apiMock.mockCollection['delete']).toHaveBeenCalledWith('doc-1');
			expect(emitted).toHaveLength(1);
			expect(router.navigate).toHaveBeenCalled();
		});

		it('should pass undefined title when entityTitle matches fallback', async () => {
			const entity = { id: 'doc-1' };
			component.entity.set(entity);
			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');

			mockFeedback.confirmDelete.mockResolvedValue(true);

			await component.onDeleteClick();

			// entityTitle returns "Post doc-1", which matches the fallback pattern
			expect(mockFeedback.confirmDelete).toHaveBeenCalledWith('Post', undefined);
		});

		it('should handle delete API failure gracefully', async () => {
			const entity = { id: 'doc-1', title: 'Test' };
			component.entity.set(entity);
			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');

			mockFeedback.confirmDelete.mockResolvedValue(true);
			apiMock.mockCollection['delete'].mockRejectedValue(new Error('Delete failed'));

			// Should not throw
			await component.onDeleteClick();

			// Should not navigate since delete failed
			expect(router.navigate).not.toHaveBeenCalled();
		});
	});

	// ------------------------------------------------------------------
	// onRestoreClick (L575-588)
	// ------------------------------------------------------------------
	describe('onRestoreClick - with entity', () => {
		it('should call restore API and update entity', async () => {
			const entity = { id: 'doc-1', title: 'Deleted Post' };
			component.entity.set(entity);
			fixture.componentRef.setInput('collection', createMockCollection({ softDelete: true }));
			fixture.componentRef.setInput('entityId', 'doc-1');

			const restored = { id: 'doc-1', title: 'Deleted Post', deletedAt: null };
			apiMock.mockCollection['restore'].mockResolvedValue(restored);

			await component.onRestoreClick();

			expect(apiMock.mockCollection['restore']).toHaveBeenCalledWith('doc-1');
			expect(component.entity()).toEqual(restored);
		});

		it('should handle restore API failure gracefully', async () => {
			const entity = { id: 'doc-1' };
			component.entity.set(entity);
			fixture.componentRef.setInput('collection', createMockCollection({ softDelete: true }));
			fixture.componentRef.setInput('entityId', 'doc-1');

			apiMock.mockCollection['restore'].mockRejectedValue(new Error('Restore failed'));

			// Should not throw
			await component.onRestoreClick();

			// Entity should remain unchanged
			expect(component.entity()).toEqual(entity);
		});
	});

	// ------------------------------------------------------------------
	// onForceDeleteClick (L590-609)
	// ------------------------------------------------------------------
	describe('onForceDeleteClick - confirmed path', () => {
		it('should force delete, emit delete_, and navigate back', async () => {
			const entity = { id: 'doc-1', title: 'Trashed Post' };
			component.entity.set(entity);
			fixture.componentRef.setInput('collection', createMockCollection({ softDelete: true }));
			fixture.componentRef.setInput('entityId', 'doc-1');

			mockFeedback.confirmDelete.mockResolvedValue(true);
			apiMock.mockCollection['forceDelete'].mockResolvedValue({ id: 'doc-1', deleted: true });

			const emitted: unknown[] = [];
			component.delete_.subscribe((e) => emitted.push(e));

			await component.onForceDeleteClick();

			expect(mockFeedback.confirmDelete).toHaveBeenCalledWith('Post', 'Trashed Post');
			expect(apiMock.mockCollection['forceDelete']).toHaveBeenCalledWith('doc-1');
			expect(emitted).toHaveLength(1);
			expect(router.navigate).toHaveBeenCalled();
		});

		it('should handle forceDelete API failure gracefully', async () => {
			const entity = { id: 'doc-1', title: 'Post' };
			component.entity.set(entity);
			fixture.componentRef.setInput('collection', createMockCollection({ softDelete: true }));
			fixture.componentRef.setInput('entityId', 'doc-1');

			mockFeedback.confirmDelete.mockResolvedValue(true);
			apiMock.mockCollection['forceDelete'].mockRejectedValue(new Error('Force delete failed'));

			await component.onForceDeleteClick();

			// Should not navigate since force delete failed
			expect(router.navigate).not.toHaveBeenCalled();
		});

		it('should pass undefined title for fallback entity title', async () => {
			const entity = { id: 'doc-1' }; // no title/name/label/subject
			component.entity.set(entity);
			fixture.componentRef.setInput('collection', createMockCollection({ softDelete: true }));
			fixture.componentRef.setInput('entityId', 'doc-1');

			mockFeedback.confirmDelete.mockResolvedValue(true);

			await component.onForceDeleteClick();

			// entityTitle = "Post doc-1", matches fallback so undefined is passed
			expect(mockFeedback.confirmDelete).toHaveBeenCalledWith('Post', undefined);
		});
	});

	// ------------------------------------------------------------------
	// onVersionRestored (L645-648)
	// ------------------------------------------------------------------
	describe('onVersionRestored', () => {
		it('should reload the entity', async () => {
			apiMock.mockCollection['findById'].mockResolvedValue({
				id: 'doc-1',
				title: 'Restored version',
			});

			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.entity()).toBeTruthy();
			});

			// Reset mock to track the reload call
			apiMock.mockCollection['findById'].mockClear();
			apiMock.mockCollection['findById'].mockResolvedValue({
				id: 'doc-1',
				title: 'Version 2',
			});

			component.onVersionRestored();

			await vi.waitFor(() => {
				expect(apiMock.mockCollection['findById']).toHaveBeenCalled();
			});
		});
	});

	// ------------------------------------------------------------------
	// getFieldDisplayType — additional branches
	// ------------------------------------------------------------------
	describe('getFieldDisplayType - extra branches', () => {
		beforeEach(() => {
			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');
		});

		it('should map textarea to text', () => {
			const field: Field = { name: 'bio', type: 'textarea' };
			expect(component.getFieldDisplayType(field)).toBe('text');
		});

		it('should map radio to badge', () => {
			const field: Field = {
				name: 'priority',
				type: 'radio',
				options: [{ label: 'High', value: 'high' }],
			};
			expect(component.getFieldDisplayType(field)).toBe('badge');
		});

		it('should return text for unknown field type', () => {
			const field = { name: 'custom', type: 'unknown-type' } as unknown as Field;
			expect(component.getFieldDisplayType(field)).toBe('text');
		});
	});

	// ------------------------------------------------------------------
	// getNumberFormat / getDateFormat — with displayFormat
	// ------------------------------------------------------------------
	describe('getNumberFormat with displayFormat', () => {
		beforeEach(() => {
			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');
		});

		it('should return displayFormat for number field', () => {
			const field: Field = {
				name: 'price',
				type: 'number',
				displayFormat: { style: 'currency', currency: 'USD' },
			} as unknown as Field;
			const result = component.getNumberFormat(field);
			expect(result).toEqual({ style: 'currency', currency: 'USD' });
		});

		it('should return undefined for number without displayFormat', () => {
			const field: Field = { name: 'count', type: 'number' };
			expect(component.getNumberFormat(field)).toBeUndefined();
		});
	});

	describe('getDateFormat with displayFormat', () => {
		beforeEach(() => {
			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');
		});

		it('should return displayFormat for date field', () => {
			const field: Field = {
				name: 'dueDate',
				type: 'date',
				displayFormat: { preset: 'medium' },
			} as unknown as Field;
			const result = component.getDateFormat(field);
			expect(result).toEqual({ preset: 'medium' });
		});

		it('should return undefined for date without displayFormat', () => {
			const field: Field = { name: 'createdAt', type: 'date' };
			expect(component.getDateFormat(field)).toBeUndefined();
		});
	});

	// ------------------------------------------------------------------
	// isDeleted computed — with soft delete
	// ------------------------------------------------------------------
	describe('isDeleted with soft delete', () => {
		it('should return true when entity has soft delete field set', () => {
			fixture.componentRef.setInput('collection', createMockCollection({ softDelete: true }));
			fixture.componentRef.setInput('entityId', 'doc-1');
			component.entity.set({ id: 'doc-1', deletedAt: '2024-01-01T00:00:00Z' });
			expect(component.isDeleted()).toBe(true);
		});

		it('should return false when entity does not have soft delete field', () => {
			fixture.componentRef.setInput('collection', createMockCollection({ softDelete: true }));
			fixture.componentRef.setInput('entityId', 'doc-1');
			component.entity.set({ id: 'doc-1' });
			expect(component.isDeleted()).toBe(false);
		});
	});

	// ------------------------------------------------------------------
	// hasTimestamps — object form
	// ------------------------------------------------------------------
	describe('hasTimestamps - object form', () => {
		it('should return true when timestamps is an object with createdAt not disabled', () => {
			fixture.componentRef.setInput(
				'collection',
				createMockCollection({
					timestamps: { createdAt: true, updatedAt: true } as unknown as boolean,
				}),
			);
			fixture.componentRef.setInput('entityId', 'doc-1');
			expect(component.hasTimestamps()).toBe(true);
		});

		it('should return false when timestamps object has createdAt: false', () => {
			fixture.componentRef.setInput(
				'collection',
				createMockCollection({
					timestamps: { createdAt: false } as unknown as boolean,
				}),
			);
			fixture.componentRef.setInput('entityId', 'doc-1');
			expect(component.hasTimestamps()).toBe(false);
		});
	});

	// ------------------------------------------------------------------
	// getFieldValue — label populated relationship
	// ------------------------------------------------------------------
	describe('getFieldValue - label populated relationship', () => {
		it('should resolve populated relationship with label field', () => {
			fixture.componentRef.setInput('collection', createMockCollection());
			fixture.componentRef.setInput('entityId', 'doc-1');
			component.entity.set({
				id: 'doc-1',
				author: { id: 'u1', label: 'Admin User' },
			});
			expect(component.getFieldValue('author')).toBe('Admin User');
		});
	});

	// ------------------------------------------------------------------
	// loadEntity with soft delete — passes withDeleted option
	// ------------------------------------------------------------------
	describe('loadEntity with soft delete', () => {
		it('should pass withDeleted: true when collection has soft delete', async () => {
			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				title: 'Soft',
				deletedAt: '2024-01-01',
			});

			fixture.componentRef.setInput('collection', createMockCollection({ softDelete: true }));
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.entity()).toBeTruthy();
			});

			expect(apiMock.mockCollection['findById']).toHaveBeenCalledWith('doc-1', {
				depth: 1,
				withDeleted: true,
			});
		});
	});

	// ------------------------------------------------------------------
	// Relationship resolution with useAsTitle admin config
	// ------------------------------------------------------------------
	describe('resolveRelationships with useAsTitle', () => {
		it('should use admin.useAsTitle field for relationship resolution', async () => {
			const relCollection: CollectionConfig = {
				slug: 'authors',
				fields: [{ name: 'fullName', type: 'text' } as Field],
				admin: { useAsTitle: 'fullName' } as CollectionConfig['admin'],
			};

			const col = createMockCollection({
				fields: [
					{
						name: 'author',
						type: 'relationship',
						collection: () => relCollection,
					} as unknown as Field,
				],
			});

			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'doc-1',
				author: 'author-1',
			});
			apiMock.mockCollection['findById'].mockResolvedValueOnce({
				id: 'author-1',
				fullName: 'John Smith',
			});

			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('entityId', 'doc-1');
			fixture.detectChanges();

			await vi.waitFor(() => {
				expect(component.resolvedRelationships().size).toBeGreaterThan(0);
			});

			expect(component.resolvedRelationships().get('author')).toBe('John Smith');
		});
	});
});

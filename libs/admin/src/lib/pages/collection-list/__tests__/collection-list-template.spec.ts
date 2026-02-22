/**
 * Template expression coverage tests for CollectionListPage.
 *
 * Exercises all template-bound signals, computed values, and methods to
 * cover uncovered template statements and method branches.
 *
 * Specifically covers:
 * - collection() truthiness
 * - bulkActions() and headerActions() computed signals
 * - onEntityClick() navigation
 * - onBulkAction() delete flow with batchDelete
 * - onHeaderAction() with generate-key dialog and afterClosed handling
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import type { CollectionConfig } from '@momentumcms/core';
import { CollectionListPage } from '../collection-list.page';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { MOMENTUM_API } from '../../../services/momentum-api.service';
import { FeedbackService } from '../../../widgets/feedback/feedback.service';
import { DialogService } from '@momentumcms/ui';
import type { EntityListBulkActionEvent } from '../../../widgets/entity-list/entity-list.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollection(overrides: Partial<CollectionConfig> & { slug: string }): CollectionConfig {
	return { fields: [], ...overrides };
}

function makeActivatedRoute(
	slug: string,
	collections: CollectionConfig[],
): Record<string, unknown> {
	return {
		paramMap: of({
			get: (key: string): string | null => (key === 'slug' ? slug : null),
		}),
		snapshot: {
			paramMap: {
				get: (key: string): string | null => (key === 'slug' ? slug : null),
			},
			data: {},
		},
		parent: {
			snapshot: {
				data: { collections },
			},
		},
	};
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockCollection(): Record<string, ReturnType<typeof vi.fn>> {
	return {
		find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 1 }),
		findById: vi.fn().mockResolvedValue({}),
		create: vi.fn().mockResolvedValue({}),
		update: vi.fn().mockResolvedValue({}),
		delete: vi.fn().mockResolvedValue({ id: '1', deleted: true }),
		batchDelete: vi.fn().mockResolvedValue([]),
	};
}

function createMockApi(
	coll: Record<string, ReturnType<typeof vi.fn>>,
): Record<string, ReturnType<typeof vi.fn>> {
	return {
		collection: vi.fn().mockReturnValue(coll),
		global: vi.fn().mockReturnValue({ find: vi.fn(), update: vi.fn() }),
		getConfig: vi.fn().mockReturnValue({ collections: [] }),
		setContext: vi.fn().mockReturnThis(),
		getContext: vi.fn().mockReturnValue({}),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectionListPage - template expression coverage', () => {
	const posts = makeCollection({
		slug: 'posts',
		labels: { plural: 'Posts', singular: 'Post' },
	});
	const apiKeys = makeCollection({
		slug: 'api-keys',
		admin: {
			headerActions: [
				{ id: 'generate-key', label: 'Generate Key', endpoint: '/api/auth/api-keys' },
			],
		},
	});
	const allCollections = [posts, apiKeys];

	let mockCollection: Record<string, ReturnType<typeof vi.fn>>;
	let mockApi: Record<string, ReturnType<typeof vi.fn>>;
	let mockRouter: { navigate: ReturnType<typeof vi.fn> };
	let mockDialogService: { open: ReturnType<typeof vi.fn> };
	let mockFeedbackService: Record<string, ReturnType<typeof vi.fn>>;

	function setup(
		slug = 'posts',
		collections: CollectionConfig[] = allCollections,
	): { fixture: ComponentFixture<CollectionListPage>; component: CollectionListPage } {
		mockCollection = createMockCollection();
		mockApi = createMockApi(mockCollection);
		mockRouter = { navigate: vi.fn().mockResolvedValue(true) };
		mockDialogService = {
			open: vi.fn().mockReturnValue({ afterClosed: new Subject() }),
		};
		mockFeedbackService = {
			entityCreated: vi.fn(),
			entityDeleted: vi.fn(),
			entitiesDeleted: vi.fn(),
			operationFailed: vi.fn(),
			confirmBulkDelete: vi.fn().mockResolvedValue(true),
		};

		const mockAccessService: Partial<CollectionAccessService> = {
			accessibleCollections: computed(() => collections.map((c) => c.slug)),
			initialized: signal(true),
			loading: signal(false),
			canCreate: () => true,
			canRead: () => true,
			canUpdate: () => true,
			canDelete: () => true,
			canAccess: () => true,
		};

		TestBed.configureTestingModule({
			imports: [CollectionListPage],
			providers: [
				{ provide: PLATFORM_ID, useValue: 'server' },
				{ provide: MOMENTUM_API, useValue: mockApi },
				{ provide: Router, useValue: mockRouter },
				{ provide: CollectionAccessService, useValue: mockAccessService },
				{ provide: DialogService, useValue: mockDialogService },
				{ provide: FeedbackService, useValue: mockFeedbackService },
				{
					provide: ActivatedRoute,
					useValue: makeActivatedRoute(slug, collections),
				},
			],
		}).overrideComponent(CollectionListPage, {
			set: { template: '', imports: [] },
		});

		const fixture = TestBed.createComponent(CollectionListPage);
		const component = fixture.componentInstance;
		fixture.detectChanges();
		return { fixture, component };
	}

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	// -----------------------------------------------------------------------
	// Template branch: collection() truthy/falsy
	// -----------------------------------------------------------------------
	describe('collection() template branch', () => {
		it('should be truthy when collection exists', () => {
			const { component } = setup('posts');
			expect(!!component.collection()).toBe(true);
		});

		it('should be falsy when collection does not exist', () => {
			const { component } = setup('nonexistent');
			expect(!!component.collection()).toBe(false);
		});

		it('should be falsy for empty slug', () => {
			const { component } = setup('');
			expect(!!component.collection()).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: bulkActions()
	// -----------------------------------------------------------------------
	describe('bulkActions() template binding', () => {
		it('should include delete action', () => {
			const { component } = setup('posts');
			const actions = component.bulkActions();
			expect(actions).toHaveLength(1);
			expect(actions[0].id).toBe('delete');
			expect(actions[0].label).toBe('Delete');
			expect(actions[0].variant).toBe('destructive');
			expect(actions[0].requiresConfirmation).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: headerActions()
	// -----------------------------------------------------------------------
	describe('headerActions() template binding', () => {
		it('should return empty array for collection without header actions', () => {
			const { component } = setup('posts');
			expect(component.headerActions()).toEqual([]);
		});

		it('should return header actions from collection admin config', () => {
			const { component } = setup('api-keys');
			const actions = component.headerActions();
			expect(actions).toHaveLength(1);
			expect(actions[0].id).toBe('generate-key');
		});

		it('should return empty array when collection not found', () => {
			const { component } = setup('nonexistent');
			expect(component.headerActions()).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// onEntityClick: navigation
	// -----------------------------------------------------------------------
	describe('onEntityClick', () => {
		it('should navigate to entity detail page', () => {
			const { component } = setup('posts');
			component.onEntityClick({ id: 'doc-1' });
			expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/collections', 'posts', 'doc-1']);
		});

		it('should navigate with numeric id', () => {
			const { component } = setup('posts');
			component.onEntityClick({ id: 42 });
			expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/collections', 'posts', 42]);
		});

		it('should not navigate when collection not found', () => {
			const { component } = setup('nonexistent');
			component.onEntityClick({ id: 'doc-1' });
			expect(mockRouter.navigate).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// onBulkAction: delete flow
	// -----------------------------------------------------------------------
	describe('onBulkAction', () => {
		it('should call batchDelete with entity IDs for delete action', async () => {
			const { component } = setup('posts');

			const event: EntityListBulkActionEvent = {
				action: {
					id: 'delete',
					label: 'Delete',
					variant: 'destructive',
					requiresConfirmation: true,
				},
				entities: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
			};

			await component.onBulkAction(event);
			expect(mockCollection['batchDelete']).toHaveBeenCalledWith(['e1', 'e2', 'e3']);
		});

		it('should not call batchDelete when collection not found', async () => {
			const { component } = setup('nonexistent');

			const event: EntityListBulkActionEvent = {
				action: { id: 'delete', label: 'Delete' },
				entities: [{ id: 'e1' }],
			};

			await component.onBulkAction(event);
			expect(mockCollection['batchDelete']).not.toHaveBeenCalled();
		});

		it('should not call batchDelete for non-delete action', async () => {
			const { component } = setup('posts');

			const event: EntityListBulkActionEvent = {
				action: { id: 'archive', label: 'Archive' },
				entities: [{ id: 'e1' }],
			};

			await component.onBulkAction(event);
			expect(mockCollection['batchDelete']).not.toHaveBeenCalled();
		});

		it('should handle batchDelete error gracefully', async () => {
			const { component } = setup('posts');
			mockCollection['batchDelete'].mockRejectedValue(new Error('Network error'));

			const event: EntityListBulkActionEvent = {
				action: { id: 'delete', label: 'Delete' },
				entities: [{ id: 'e1' }],
			};

			await expect(component.onBulkAction(event)).resolves.toBeUndefined();
		});

		it('should convert numeric entity IDs to strings', async () => {
			const { component } = setup('posts');

			const event: EntityListBulkActionEvent = {
				action: { id: 'delete', label: 'Delete' },
				entities: [{ id: 1 }, { id: 2 }],
			};

			await component.onBulkAction(event);
			expect(mockCollection['batchDelete']).toHaveBeenCalledWith(['1', '2']);
		});
	});

	// -----------------------------------------------------------------------
	// onHeaderAction: generate-key dialog
	// -----------------------------------------------------------------------
	describe('onHeaderAction', () => {
		it('should open dialog for generate-key action with endpoint', () => {
			const { component } = setup('api-keys');

			component.onHeaderAction({
				id: 'generate-key',
				label: 'Generate Key',
				endpoint: '/api/auth/api-keys',
			});

			expect(mockDialogService.open).toHaveBeenCalled();
		});

		it('should not open dialog for non-generate-key action', () => {
			const { component } = setup('posts');

			component.onHeaderAction({
				id: 'other-action',
				label: 'Other',
			});

			expect(mockDialogService.open).not.toHaveBeenCalled();
		});

		it('should not open dialog when generate-key has no endpoint', () => {
			const { component } = setup('posts');

			component.onHeaderAction({
				id: 'generate-key',
				label: 'Generate Key',
			});

			expect(mockDialogService.open).not.toHaveBeenCalled();
		});

		it('should handle afterClosed with true (reload)', () => {
			const { component } = setup('api-keys');

			const afterClosedSubject = new Subject<boolean>();
			mockDialogService.open.mockReturnValue({
				afterClosed: afterClosedSubject.asObservable(),
			});

			component.onHeaderAction({
				id: 'generate-key',
				label: 'Generate Key',
				endpoint: '/api/auth/api-keys',
			});

			afterClosedSubject.next(true);
			afterClosedSubject.complete();

			// The entityList viewChild reload would be called
			expect(mockDialogService.open).toHaveBeenCalled();
		});

		it('should handle afterClosed with false (no reload)', () => {
			const { component } = setup('api-keys');

			const afterClosedSubject = new Subject<boolean>();
			mockDialogService.open.mockReturnValue({
				afterClosed: afterClosedSubject.asObservable(),
			});

			component.onHeaderAction({
				id: 'generate-key',
				label: 'Generate Key',
				endpoint: '/api/auth/api-keys',
			});

			afterClosedSubject.next(false);
			afterClosedSubject.complete();

			expect(mockDialogService.open).toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// basePath binding
	// -----------------------------------------------------------------------
	describe('basePath', () => {
		it('should be "/admin/collections"', () => {
			const { component } = setup();
			expect(component.basePath).toBe('/admin/collections');
		});
	});
});

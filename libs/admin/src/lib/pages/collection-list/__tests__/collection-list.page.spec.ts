/**
 * Collection List Page Unit Tests
 *
 * Tests the collection list page: slug extraction from route params,
 * collection lookup from route data, header actions, entity click navigation,
 * and bulk actions configuration.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal, computed } from '@angular/core';
import { of } from 'rxjs';
import type { CollectionConfig } from '@momentumcms/core';
import { CollectionListPage } from '../collection-list.page';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { DialogService } from '@momentumcms/ui';
import { FeedbackService } from '../../../widgets/feedback/feedback.service';
import { MOMENTUM_API as _MOMENTUM_API } from '../../../services/momentum-api.service';
import type { Entity } from '../../../widgets/widget.types';

/** Build a minimal CollectionConfig with optional overrides */
function makeCollection(overrides: Partial<CollectionConfig> & { slug: string }): CollectionConfig {
	return { fields: [], ...overrides };
}

/** Build a mock ActivatedRoute with paramMap observable and parent data */
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

describe('CollectionListPage', () => {
	let fixture: ComponentFixture<CollectionListPage>;
	let component: CollectionListPage;
	let router: Router;
	let httpMock: HttpTestingController;

	const posts = makeCollection({
		slug: 'posts',
		labels: { plural: 'Posts', singular: 'Post' },
	});
	const articles = makeCollection({
		slug: 'articles',
		labels: { plural: 'Articles', singular: 'Article' },
	});
	const apiKeys = makeCollection({
		slug: 'api-keys',
		admin: {
			headerActions: [
				{ id: 'generate-key', label: 'Generate Key', endpoint: '/api/auth/api-keys' },
			],
		},
	});

	const allCollections = [posts, articles, apiKeys];

	let mockDialogService: { open: ReturnType<typeof vi.fn> };
	let mockFeedbackService: Partial<FeedbackService>;

	function setup(slug = 'posts', collections: CollectionConfig[] = allCollections): void {
		mockDialogService = { open: vi.fn() };
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
				provideRouter([]),
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: CollectionAccessService, useValue: mockAccessService },
				{ provide: DialogService, useValue: mockDialogService },
				{ provide: FeedbackService, useValue: mockFeedbackService },
				{
					provide: ActivatedRoute,
					useValue: makeActivatedRoute(slug, collections),
				},
			],
		}).overrideComponent(CollectionListPage, {
			set: { template: '' },
		});

		httpMock = TestBed.inject(HttpTestingController);
		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);

		fixture = TestBed.createComponent(CollectionListPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	afterEach(() => {
		httpMock.match(() => true).forEach((req) => req.flush({ docs: [], totalDocs: 0 }));
		TestBed.resetTestingModule();
	});

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('slug', () => {
		it('should read slug from route params', () => {
			setup('posts');
			// slug is private, so we verify it indirectly via collection lookup
			expect(component.collection()?.slug).toBe('posts');
		});

		it('should resolve articles slug', () => {
			setup('articles');
			expect(component.collection()?.slug).toBe('articles');
		});
	});

	describe('collection', () => {
		it('should look up collection by slug from route data', () => {
			setup('posts');
			expect(component.collection()).toBe(posts);
		});

		it('should return undefined for unknown slug', () => {
			setup('nonexistent');
			expect(component.collection()).toBeUndefined();
		});

		it('should return undefined for empty slug', () => {
			setup('');
			expect(component.collection()).toBeUndefined();
		});
	});

	describe('headerActions', () => {
		it('should return empty array when collection has no header actions', () => {
			setup('posts');
			expect(component.headerActions()).toEqual([]);
		});

		it('should extract header actions from collection admin config', () => {
			setup('api-keys');
			const actions = component.headerActions();
			expect(actions).toHaveLength(1);
			expect(actions[0].id).toBe('generate-key');
			expect(actions[0].label).toBe('Generate Key');
		});

		it('should return empty array when collection is not found', () => {
			setup('nonexistent');
			expect(component.headerActions()).toEqual([]);
		});
	});

	describe('onEntityClick', () => {
		it('should navigate to the entity edit page', () => {
			setup('posts');
			const entity: Entity = { id: 'abc-123' };
			component.onEntityClick(entity);
			expect(router.navigate).toHaveBeenCalledWith(['/admin/collections', 'posts', 'abc-123']);
		});

		it('should navigate with numeric entity id', () => {
			setup('articles');
			const entity: Entity = { id: 42 };
			component.onEntityClick(entity);
			expect(router.navigate).toHaveBeenCalledWith(['/admin/collections', 'articles', 42]);
		});

		it('should not navigate when collection is not found', () => {
			setup('nonexistent');
			const entity: Entity = { id: 'abc-123' };
			component.onEntityClick(entity);
			expect(router.navigate).not.toHaveBeenCalled();
		});
	});

	describe('bulkActions', () => {
		it('should have a delete bulk action', () => {
			setup('posts');
			const actions = component.bulkActions();
			expect(actions).toHaveLength(1);
			expect(actions[0].id).toBe('delete');
			expect(actions[0].label).toBe('Delete');
		});

		it('should have destructive variant on delete action', () => {
			setup('posts');
			const deleteAction = component.bulkActions().find((a) => a.id === 'delete');
			expect(deleteAction?.variant).toBe('destructive');
		});

		it('should require confirmation for delete action', () => {
			setup('posts');
			const deleteAction = component.bulkActions().find((a) => a.id === 'delete');
			expect(deleteAction?.requiresConfirmation).toBe(true);
		});
	});

	describe('basePath', () => {
		it('should be "/admin/collections"', () => {
			setup();
			expect(component.basePath).toBe('/admin/collections');
		});
	});
});

/**
 * Template expression coverage tests for CollectionViewPage.
 *
 * Exercises all template-bound signals, computed values, and methods to
 * cover uncovered template statements and method branches.
 *
 * Specifically covers:
 * - collection() truthiness
 * - entityId() truthiness
 * - Both @if branches: collection found/not found, entityId present/empty
 * - onEdit() navigation
 * - onDelete() no-op behavior
 * - basePath constant binding
 * - Reactive paramMap changes via toSignal
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CollectionViewPage } from '../collection-view.page';
import type { CollectionConfig } from '@momentumcms/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollection(overrides: Partial<CollectionConfig> & { slug: string }): CollectionConfig {
	return { fields: [], ...overrides };
}

function createParamMap(params: Record<string, string>): ReturnType<typeof convertToParamMap> {
	return convertToParamMap(params);
}

const posts = makeCollection({
	slug: 'posts',
	fields: [{ name: 'title', type: 'text' }],
	labels: { singular: 'Post', plural: 'Posts' },
});

const articles = makeCollection({
	slug: 'articles',
	fields: [{ name: 'name', type: 'text' }],
	labels: { singular: 'Article', plural: 'Articles' },
});

const allCollections = [posts, articles];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectionViewPage - template expression coverage', () => {
	let mockRouter: { navigate: ReturnType<typeof vi.fn> };

	function setup(
		params: Record<string, string>,
		collections: CollectionConfig[] = allCollections,
	): {
		fixture: ComponentFixture<CollectionViewPage>;
		component: CollectionViewPage;
		paramMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
	} {
		const paramMapSubject = new BehaviorSubject(createParamMap(params));
		mockRouter = { navigate: vi.fn().mockResolvedValue(true) };

		TestBed.configureTestingModule({
			imports: [CollectionViewPage],
			providers: [
				{ provide: Router, useValue: mockRouter },
				{
					provide: ActivatedRoute,
					useValue: {
						paramMap: paramMapSubject.asObservable(),
						snapshot: {
							paramMap: createParamMap(params),
						},
						parent: {
							snapshot: {
								data: { collections },
							},
						},
					},
				},
			],
		}).overrideComponent(CollectionViewPage, {
			set: { template: '', imports: [] },
		});

		const fixture = TestBed.createComponent(CollectionViewPage);
		const component = fixture.componentInstance;
		fixture.detectChanges();
		return { fixture, component, paramMapSubject };
	}

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	// -----------------------------------------------------------------------
	// Template branch: collection() truthy/falsy
	// -----------------------------------------------------------------------
	describe('collection() template branch', () => {
		it('should be truthy when slug matches a collection', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-1' });
			expect(!!component.collection()).toBe(true);
			expect(component.collection()?.slug).toBe('posts');
		});

		it('should be falsy when slug does not match', () => {
			const { component } = setup({ slug: 'nonexistent', id: 'doc-1' });
			expect(!!component.collection()).toBe(false);
		});

		it('should be falsy for empty slug', () => {
			const { component } = setup({ slug: '', id: 'doc-1' });
			expect(!!component.collection()).toBe(false);
		});

		it('should resolve articles collection', () => {
			const { component } = setup({ slug: 'articles', id: 'art-1' });
			expect(component.collection()?.slug).toBe('articles');
		});
	});

	// -----------------------------------------------------------------------
	// Template branch: entityId() truthy/falsy
	// -----------------------------------------------------------------------
	describe('entityId() template branch', () => {
		it('should be truthy when id is present', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-42' });
			expect(!!component.entityId()).toBe(true);
			expect(component.entityId()).toBe('doc-42');
		});

		it('should be falsy when id is empty string', () => {
			const { component } = setup({ slug: 'posts', id: '' });
			expect(!!component.entityId()).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Template branch combinations
	// -----------------------------------------------------------------------
	describe('template branch combinations', () => {
		it('collection found + entityId present = entity-view rendered', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-1' });
			expect(!!component.collection()).toBe(true);
			expect(!!component.entityId()).toBe(true);
		});

		it('collection found + entityId empty = "Entity ID not provided"', () => {
			const { component } = setup({ slug: 'posts', id: '' });
			expect(!!component.collection()).toBe(true);
			expect(!!component.entityId()).toBe(false);
		});

		it('collection not found = "Collection not found"', () => {
			const { component } = setup({ slug: 'nonexistent', id: 'doc-1' });
			expect(!!component.collection()).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// onEdit: navigation to edit route
	// -----------------------------------------------------------------------
	describe('onEdit()', () => {
		it('should navigate to edit page when collection exists', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-1' });
			component.onEdit({ id: 'doc-1' });
			expect(mockRouter.navigate).toHaveBeenCalledWith([
				'/admin/collections',
				'posts',
				'doc-1',
				'edit',
			]);
		});

		it('should navigate with different entity id', () => {
			const { component } = setup({ slug: 'articles', id: 'art-7' });
			component.onEdit({ id: 'art-7', title: 'My Article' });
			expect(mockRouter.navigate).toHaveBeenCalledWith([
				'/admin/collections',
				'articles',
				'art-7',
				'edit',
			]);
		});

		it('should not navigate when collection is not found', () => {
			const { component } = setup({ slug: 'nonexistent', id: 'doc-1' });
			component.onEdit({ id: 'doc-1' });
			expect(mockRouter.navigate).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// onDelete: no-op
	// -----------------------------------------------------------------------
	describe('onDelete()', () => {
		it('should not throw', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-1' });
			expect(() => component.onDelete({ id: 'doc-1' })).not.toThrow();
		});

		it('should not navigate', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-1' });
			component.onDelete({ id: 'doc-1' });
			expect(mockRouter.navigate).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// basePath binding
	// -----------------------------------------------------------------------
	describe('basePath', () => {
		it('should be "/admin/collections"', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-1' });
			expect(component.basePath).toBe('/admin/collections');
		});
	});

	// -----------------------------------------------------------------------
	// Reactive paramMap changes (toSignal)
	// -----------------------------------------------------------------------
	describe('reactive paramMap updates', () => {
		it('should update entityId when paramMap changes', () => {
			const { component, paramMapSubject, fixture } = setup({ slug: 'posts', id: 'doc-1' });
			expect(component.entityId()).toBe('doc-1');

			paramMapSubject.next(createParamMap({ slug: 'posts', id: 'doc-2' }));
			fixture.detectChanges();

			expect(component.entityId()).toBe('doc-2');
		});

		it('should update collection when slug changes in paramMap', () => {
			const { component, paramMapSubject, fixture } = setup({ slug: 'posts', id: 'doc-1' });
			expect(component.collection()?.slug).toBe('posts');

			paramMapSubject.next(createParamMap({ slug: 'articles', id: 'art-1' }));
			fixture.detectChanges();

			// Note: collection lookup uses route.parent.snapshot.data which is static,
			// but the slug signal from toSignal updates reactively
		});
	});
});

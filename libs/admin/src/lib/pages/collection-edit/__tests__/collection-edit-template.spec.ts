/**
 * Template expression coverage tests for CollectionEditPage.
 *
 * Exercises all template-bound signals, computed values, and methods to
 * cover uncovered template statements and method branches. Since the
 * Angular JIT compiler can't compile new control flow (@if/@for), we
 * override the template but exercise every binding path.
 *
 * Specifically covers:
 * - collection() truthiness (found vs not found)
 * - previewConfig() truthiness
 * - showPreview() toggle
 * - entityId() extraction from route params
 * - mode() computed (create/edit/view)
 * - formData() computed
 * - hasUnsavedChanges()
 * - onEditBlockRequest() with various edge cases
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { CollectionConfig, BlocksField } from '@momentumcms/core';
import { CollectionEditPage } from '../collection-edit.page';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { DialogService } from '@momentumcms/ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollection(overrides: Partial<CollectionConfig> & { slug: string }): CollectionConfig {
	return { fields: [], ...overrides };
}

function makeActivatedRoute(
	params: Record<string, string | null>,
	collections: CollectionConfig[],
): Record<string, unknown> {
	return {
		snapshot: {
			paramMap: {
				get: (key: string): string | null => params[key] ?? null,
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
// Tests
// ---------------------------------------------------------------------------

describe('CollectionEditPage - template expression coverage', () => {
	const posts = makeCollection({
		slug: 'posts',
		labels: { plural: 'Posts', singular: 'Post' },
	});
	const previewablePages = makeCollection({
		slug: 'pages',
		admin: { preview: '/preview/pages/{slug}' },
	});
	const blocksCollection = makeCollection({
		slug: 'pages-with-blocks',
		fields: [
			{
				name: 'layout',
				type: 'blocks',
				blocks: [
					{ slug: 'hero', fields: [{ name: 'title', type: 'text' }] },
					{ slug: 'cta', fields: [{ name: 'text', type: 'text' }] },
				],
			} as unknown as BlocksField,
		],
	});
	const allCollections = [posts, previewablePages, blocksCollection];

	let mockDialogService: { open: ReturnType<typeof vi.fn> };

	function setup(
		params: Record<string, string | null> = { slug: 'posts', id: 'create' },
		collections: CollectionConfig[] = allCollections,
		canUpdate: (slug: string) => boolean = () => true,
	): { fixture: ComponentFixture<CollectionEditPage>; component: CollectionEditPage } {
		mockDialogService = { open: vi.fn() };

		const mockAccessService: Partial<CollectionAccessService> = {
			accessibleCollections: computed(() => collections.map((c) => c.slug)),
			initialized: signal(true),
			loading: signal(false),
			canCreate: () => true,
			canRead: () => true,
			canUpdate: (slug: string) => canUpdate(slug),
			canDelete: () => true,
			canAccess: () => true,
		};

		TestBed.configureTestingModule({
			imports: [CollectionEditPage],
			providers: [
				{ provide: CollectionAccessService, useValue: mockAccessService },
				{ provide: DialogService, useValue: mockDialogService },
				{
					provide: ActivatedRoute,
					useValue: makeActivatedRoute(params, collections),
				},
			],
		}).overrideComponent(CollectionEditPage, {
			set: { template: '', imports: [] },
		});

		const fixture = TestBed.createComponent(CollectionEditPage);
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
			const { component } = setup({ slug: 'posts', id: 'create' });
			expect(!!component.collection()).toBe(true);
		});

		it('should be falsy when collection does not exist', () => {
			const { component } = setup({ slug: 'nonexistent', id: 'create' });
			expect(!!component.collection()).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Template branch: previewConfig() truthy/falsy
	// -----------------------------------------------------------------------
	describe('previewConfig() template branch', () => {
		it('should be truthy for collection with preview config', () => {
			const { component } = setup({ slug: 'pages', id: 'create' });
			expect(!!component.previewConfig()).toBe(true);
		});

		it('should be falsy for collection without preview config', () => {
			const { component } = setup({ slug: 'posts', id: 'create' });
			expect(!!component.previewConfig()).toBe(false);
		});

		it('should be falsy when collection not found', () => {
			const { component } = setup({ slug: 'nonexistent', id: 'create' });
			expect(!!component.previewConfig()).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Template branch: showPreview() toggle
	// -----------------------------------------------------------------------
	describe('showPreview() template branch', () => {
		it('should default to true', () => {
			const { component } = setup({ slug: 'pages', id: 'abc' });
			expect(component.showPreview()).toBe(true);
		});

		it('should toggle to false (show "Show Preview" button)', () => {
			const { component } = setup({ slug: 'pages', id: 'abc' });
			component.showPreview.set(false);
			expect(component.showPreview()).toBe(false);
		});

		it('should toggle back to true (show "Hide Preview" button)', () => {
			const { component } = setup({ slug: 'pages', id: 'abc' });
			component.showPreview.set(false);
			component.showPreview.set(true);
			expect(component.showPreview()).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: entityId() (from route params)
	// -----------------------------------------------------------------------
	describe('entityId() template binding', () => {
		it('should be undefined for "create"', () => {
			const { component } = setup({ slug: 'posts', id: 'create' });
			expect(component.entityId()).toBeUndefined();
		});

		it('should be undefined for null id', () => {
			const { component } = setup({ slug: 'posts' });
			expect(component.entityId()).toBeUndefined();
		});

		it('should extract id from params', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-99' });
			expect(component.entityId()).toBe('doc-99');
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: mode() computed
	// -----------------------------------------------------------------------
	describe('mode() template binding', () => {
		it('should be "create" when no entityId', () => {
			const { component } = setup({ slug: 'posts', id: 'create' });
			expect(component.mode()).toBe('create');
		});

		it('should be "edit" when entityId present and canUpdate', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-1' }, allCollections, () => true);
			expect(component.mode()).toBe('edit');
		});

		it('should be "view" when entityId present and cannot update', () => {
			const { component } = setup({ slug: 'posts', id: 'doc-1' }, allCollections, () => false);
			expect(component.mode()).toBe('view');
		});

		it('should be "edit" when collection not found but entityId present (canUpdate check skipped)', () => {
			const { component } = setup({ slug: 'nonexistent', id: 'doc-1' });
			// When collection is undefined, canUpdate check is skipped, returns 'edit'
			expect(component.mode()).toBe('edit');
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: formData() computed
	// -----------------------------------------------------------------------
	describe('formData() template binding', () => {
		it('should return empty object when entity form is not present', () => {
			const { component } = setup();
			expect(component.formData()).toEqual({});
		});
	});

	// -----------------------------------------------------------------------
	// HasUnsavedChanges interface
	// -----------------------------------------------------------------------
	describe('hasUnsavedChanges()', () => {
		it('should return false when entity form is not present', () => {
			const { component } = setup();
			expect(component.hasUnsavedChanges()).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// onEditBlockRequest method coverage
	// -----------------------------------------------------------------------
	describe('onEditBlockRequest', () => {
		it('should exit early when collection is undefined', () => {
			const { component } = setup({ slug: 'nonexistent', id: 'abc' });
			expect(() => component.onEditBlockRequest(0)).not.toThrow();
			expect(mockDialogService.open).not.toHaveBeenCalled();
		});

		it('should exit early when entityFormRef is null', () => {
			const { component } = setup({ slug: 'posts', id: 'abc' });
			expect(() => component.onEditBlockRequest(0)).not.toThrow();
			expect(mockDialogService.open).not.toHaveBeenCalled();
		});

		it('should exit early when collection has no blocks field', () => {
			const { component } = setup({ slug: 'posts', id: 'abc' });
			component.onEditBlockRequest(0);
			expect(mockDialogService.open).not.toHaveBeenCalled();
		});

		it('should exit early for blocks collection when formRef is null', () => {
			const { component } = setup({ slug: 'pages-with-blocks', id: 'abc' });
			component.onEditBlockRequest(0);
			expect(mockDialogService.open).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// basePath constant
	// -----------------------------------------------------------------------
	describe('basePath template binding', () => {
		it('should be "/admin/collections"', () => {
			const { component } = setup();
			expect(component.basePath).toBe('/admin/collections');
		});
	});
});

/**
 * Collection Edit Page Unit Tests
 *
 * Tests the collection edit/create page: route param extraction,
 * mode determination (create/edit/view), collection lookup from route data,
 * preview toggling, and the HasUnsavedChanges guard interface.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, computed } from '@angular/core';
import type { CollectionConfig } from '@momentumcms/core';
import { CollectionEditPage } from '../collection-edit.page';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { DialogService } from '@momentumcms/ui';

/** Build a minimal CollectionConfig with optional overrides */
function makeCollection(overrides: Partial<CollectionConfig> & { slug: string }): CollectionConfig {
	return { fields: [], ...overrides };
}

/** Build a mock ActivatedRoute snapshot with paramMap and parent data */
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

describe('CollectionEditPage', () => {
	let fixture: ComponentFixture<CollectionEditPage>;
	let component: CollectionEditPage;

	const posts = makeCollection({
		slug: 'posts',
		labels: { plural: 'Posts', singular: 'Post' },
	});
	const articles = makeCollection({
		slug: 'articles',
		labels: { plural: 'Articles', singular: 'Article' },
	});
	const previewablePages = makeCollection({
		slug: 'pages',
		admin: { preview: '/preview/pages/{slug}' },
	});

	const allCollections = [posts, articles, previewablePages];

	let mockCanUpdate: (slug: string) => boolean;
	let mockDialogService: { open: ReturnType<typeof vi.fn> };

	function setup(
		params: Record<string, string | null> = { slug: 'posts', id: 'create' },
		collections: CollectionConfig[] = allCollections,
		canUpdate: (slug: string) => boolean = () => true,
	): void {
		mockCanUpdate = canUpdate;
		mockDialogService = { open: vi.fn() };

		const mockAccessService: Partial<CollectionAccessService> = {
			accessibleCollections: computed(() => collections.map((c) => c.slug)),
			initialized: signal(true),
			loading: signal(false),
			canCreate: () => true,
			canRead: () => true,
			canUpdate: (slug: string) => mockCanUpdate(slug),
			canDelete: () => true,
			canAccess: () => true,
		};

		TestBed.configureTestingModule({
			imports: [CollectionEditPage],
			providers: [
				provideRouter([]),
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: CollectionAccessService, useValue: mockAccessService },
				{ provide: DialogService, useValue: mockDialogService },
				{
					provide: ActivatedRoute,
					useValue: makeActivatedRoute(params, collections),
				},
			],
		}).overrideComponent(CollectionEditPage, {
			set: { template: '' },
		});

		fixture = TestBed.createComponent(CollectionEditPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('entityId', () => {
		it('should be undefined for "create" route param', () => {
			setup({ slug: 'posts', id: 'create' });
			expect(component.entityId()).toBeUndefined();
		});

		it('should be undefined when id param is null', () => {
			setup({ slug: 'posts' });
			expect(component.entityId()).toBeUndefined();
		});

		it('should extract ID from route params', () => {
			setup({ slug: 'posts', id: 'abc-123' });
			expect(component.entityId()).toBe('abc-123');
		});

		it('should extract numeric ID from route params', () => {
			setup({ slug: 'posts', id: '42' });
			expect(component.entityId()).toBe('42');
		});
	});

	describe('mode', () => {
		it('should be "create" when no entity ID', () => {
			setup({ slug: 'posts', id: 'create' });
			expect(component.mode()).toBe('create');
		});

		it('should be "edit" when entity ID present and canUpdate is true', () => {
			setup({ slug: 'posts', id: 'abc-123' }, allCollections, () => true);
			expect(component.mode()).toBe('edit');
		});

		it('should be "view" when entity ID present and canUpdate is false', () => {
			setup({ slug: 'posts', id: 'abc-123' }, allCollections, () => false);
			expect(component.mode()).toBe('view');
		});

		it('should be "create" when id param is null', () => {
			setup({ slug: 'posts' });
			expect(component.mode()).toBe('create');
		});
	});

	describe('collection', () => {
		it('should look up collection from route data by slug', () => {
			setup({ slug: 'posts', id: 'create' });
			expect(component.collection()).toBe(posts);
		});

		it('should find articles collection', () => {
			setup({ slug: 'articles', id: 'create' });
			expect(component.collection()).toBe(articles);
		});

		it('should return undefined for unknown slug', () => {
			setup({ slug: 'nonexistent', id: 'create' });
			expect(component.collection()).toBeUndefined();
		});

		it('should return undefined when slug param is null', () => {
			setup({});
			expect(component.collection()).toBeUndefined();
		});
	});

	describe('hasUnsavedChanges', () => {
		it('should return false when entity form is not present (template stripped)', () => {
			setup();
			expect(component.hasUnsavedChanges()).toBe(false);
		});
	});

	describe('showPreview', () => {
		it('should default to true', () => {
			setup();
			expect(component.showPreview()).toBe(true);
		});

		it('should toggle preview off', () => {
			setup();
			component.showPreview.set(false);
			expect(component.showPreview()).toBe(false);
		});

		it('should toggle preview back on', () => {
			setup();
			component.showPreview.set(false);
			component.showPreview.set(true);
			expect(component.showPreview()).toBe(true);
		});
	});

	describe('previewConfig', () => {
		it('should return preview config from collection admin settings', () => {
			setup({ slug: 'pages', id: 'create' });
			expect(component.previewConfig()).toBe('/preview/pages/{slug}');
		});

		it('should return undefined when collection has no preview config', () => {
			setup({ slug: 'posts', id: 'create' });
			expect(component.previewConfig()).toBeUndefined();
		});

		it('should return undefined when collection is not found', () => {
			setup({ slug: 'nonexistent', id: 'create' });
			expect(component.previewConfig()).toBeUndefined();
		});
	});

	describe('basePath', () => {
		it('should be "/admin/collections"', () => {
			setup();
			expect(component.basePath).toBe('/admin/collections');
		});
	});

	describe('formData', () => {
		it('should return empty object when entity form is not present (template stripped)', () => {
			setup();
			expect(component.formData()).toEqual({});
		});
	});

	describe('onEditBlockRequest', () => {
		it('should not throw when collection is undefined', () => {
			setup({ slug: 'nonexistent', id: 'abc-123' });
			expect(() => component.onEditBlockRequest(0)).not.toThrow();
		});

		it('should not throw when entityFormRef is null (template stripped)', () => {
			setup({ slug: 'posts', id: 'abc-123' });
			expect(() => component.onEditBlockRequest(0)).not.toThrow();
		});

		it('should not throw when collection has no blocks field', () => {
			setup({ slug: 'posts', id: 'abc-123' });
			// posts collection has no blocks field, so this should exit early
			expect(() => component.onEditBlockRequest(0)).not.toThrow();
		});

		it('should not open dialog when no blocks field exists', () => {
			setup({ slug: 'posts', id: 'abc-123' });
			component.onEditBlockRequest(0);
			expect(mockDialogService.open).not.toHaveBeenCalled();
		});
	});
});

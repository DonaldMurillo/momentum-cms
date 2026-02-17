/**
 * Dashboard Page Unit Tests
 *
 * Tests the collection filtering logic: hidden collections are always excluded,
 * inaccessible collections are excluded after permissions load.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import type { CollectionConfig } from '@momentumcms/core';
import { DashboardPage } from '../dashboard.page';
import { CollectionAccessService } from '../../../services/collection-access.service';

/** Build a minimal CollectionConfig with optional overrides */
function makeCollection(overrides: Partial<CollectionConfig> & { slug: string }): CollectionConfig {
	return { fields: [], ...overrides };
}

describe('DashboardPage', () => {
	let fixture: ComponentFixture<DashboardPage>;
	let component: DashboardPage;
	let httpMock: HttpTestingController;

	// Collections for the test suite
	const posts = makeCollection({ slug: 'posts', labels: { plural: 'Posts' } });
	const articles = makeCollection({ slug: 'articles', labels: { plural: 'Articles' } });
	const hiddenSession = makeCollection({
		slug: 'auth-session',
		admin: { hidden: true },
	});
	const hiddenAccount = makeCollection({
		slug: 'auth-account',
		admin: { hidden: true },
	});
	const authUser = makeCollection({
		slug: 'auth-user',
		labels: { plural: 'Users' },
	});

	const allCollections = [posts, articles, hiddenSession, hiddenAccount, authUser];

	// Mutable signals we control from tests
	let accessibleCollections: ReturnType<typeof signal<string[]>>;
	let initialized: ReturnType<typeof signal<boolean>>;

	beforeEach(async () => {
		accessibleCollections = signal<string[]>([]);
		initialized = signal(false);

		const mockAccessService: Partial<CollectionAccessService> = {
			accessibleCollections: computed(() => accessibleCollections()),
			initialized: initialized,
			loading: signal(false),
			canCreate: () => true,
			canRead: () => true,
			canUpdate: () => true,
			canDelete: () => true,
			canAccess: () => true,
		};

		await TestBed.configureTestingModule({
			imports: [DashboardPage],
			providers: [
				provideRouter([]),
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: CollectionAccessService, useValue: mockAccessService },
				{
					provide: ActivatedRoute,
					useValue: {
						parent: {
							snapshot: {
								data: { collections: allCollections },
							},
						},
						snapshot: { data: {} },
					},
				},
			],
		}).compileComponents();

		httpMock = TestBed.inject(HttpTestingController);
		fixture = TestBed.createComponent(DashboardPage);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		// Flush any pending count requests from collection cards
		httpMock.match(() => true).forEach((req) => req.flush({ docs: [], totalDocs: 0 }));
	});

	describe('before permissions load (initialized = false)', () => {
		it('should show all non-hidden collections', () => {
			fixture.detectChanges();

			const slugs = component.collections().map((c) => c.slug);
			expect(slugs).toEqual(['posts', 'articles', 'auth-user']);
		});

		it('should NOT show hidden collections', () => {
			fixture.detectChanges();

			const slugs = component.collections().map((c) => c.slug);
			expect(slugs).not.toContain('auth-session');
			expect(slugs).not.toContain('auth-account');
		});
	});

	describe('after permissions load (initialized = true)', () => {
		it('should filter to only accessible non-hidden collections', () => {
			initialized.set(true);
			accessibleCollections.set(['posts', 'auth-user']);
			fixture.detectChanges();

			const slugs = component.collections().map((c) => c.slug);
			expect(slugs).toEqual(['posts', 'auth-user']);
		});

		it('should exclude non-hidden collections that are inaccessible', () => {
			initialized.set(true);
			accessibleCollections.set(['posts']); // articles and auth-user not accessible
			fixture.detectChanges();

			const slugs = component.collections().map((c) => c.slug);
			expect(slugs).toEqual(['posts']);
			expect(slugs).not.toContain('articles');
			expect(slugs).not.toContain('auth-user');
		});

		it('should never show hidden collections even if they are accessible', () => {
			initialized.set(true);
			accessibleCollections.set(['posts', 'articles', 'auth-session', 'auth-account', 'auth-user']);
			fixture.detectChanges();

			const slugs = component.collections().map((c) => c.slug);
			expect(slugs).toEqual(['posts', 'articles', 'auth-user']);
			expect(slugs).not.toContain('auth-session');
			expect(slugs).not.toContain('auth-account');
		});

		it('should show empty list when no collections are accessible', () => {
			initialized.set(true);
			accessibleCollections.set([]);
			fixture.detectChanges();

			expect(component.collections()).toEqual([]);
		});
	});

	describe('collectionGroups computed signal', () => {
		async function setupWithCollections(collections: CollectionConfig[]): Promise<{
			component: DashboardPage;
			accessibleCollections: ReturnType<typeof signal<string[]>>;
			initialized: ReturnType<typeof signal<boolean>>;
		}> {
			// Reset any TestBed configured by outer beforeEach
			TestBed.resetTestingModule();

			const localAccessible = signal<string[]>([]);
			const localInitialized = signal(false);

			const mockAccessService: Partial<CollectionAccessService> = {
				accessibleCollections: computed(() => localAccessible()),
				initialized: localInitialized,
				loading: signal(false),
				canCreate: () => true,
				canRead: () => true,
				canUpdate: () => true,
				canDelete: () => true,
				canAccess: () => true,
			};

			await TestBed.configureTestingModule({
				imports: [DashboardPage],
				providers: [
					provideRouter([]),
					provideHttpClient(),
					provideHttpClientTesting(),
					{ provide: CollectionAccessService, useValue: mockAccessService },
					{
						provide: ActivatedRoute,
						useValue: {
							parent: { snapshot: { data: { collections } } },
							snapshot: { data: {} },
						},
					},
				],
			}).compileComponents();

			const localFixture = TestBed.createComponent(DashboardPage);
			localFixture.detectChanges();
			TestBed.inject(HttpTestingController)
				.match(() => true)
				.forEach((req) => req.flush({ docs: [], totalDocs: 0 }));

			return {
				component: localFixture.componentInstance,
				accessibleCollections: localAccessible,
				initialized: localInitialized,
			};
		}

		afterEach(() => TestBed.resetTestingModule());

		it('should return empty array when there are no collections', async () => {
			const { component } = await setupWithCollections([]);
			expect(component.collectionGroups()).toEqual([]);
		});

		it('should put ungrouped collections into the default "Collections" group', async () => {
			const media = makeCollection({ slug: 'media', labels: { plural: 'Media' } });
			const { component } = await setupWithCollections([media]);

			const groups = component.collectionGroups();
			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe('Collections');
			expect(groups[0].collections.map((c) => c.slug)).toEqual(['media']);
		});

		it('should put collections with admin.group into their named group', async () => {
			const a = makeCollection({ slug: 'posts', admin: { group: 'Content' } });
			const b = makeCollection({ slug: 'articles', admin: { group: 'Content' } });
			const { component } = await setupWithCollections([a, b]);

			const groups = component.collectionGroups();
			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe('Content');
			expect(groups[0].collections.map((c) => c.slug)).toEqual(['posts', 'articles']);
		});

		it('should render named groups before the default Collections group', async () => {
			const a = makeCollection({ slug: 'posts', admin: { group: 'Content' } });
			const b = makeCollection({ slug: 'users', admin: { group: 'Auth' } });
			const c = makeCollection({ slug: 'media' });
			const { component } = await setupWithCollections([a, b, c]);

			const groupNames = component.collectionGroups().map((g) => g.name);
			expect(groupNames).toEqual(['Content', 'Auth', 'Collections']);
		});

		it('should render named groups before default even when ungrouped collection appears first in input', async () => {
			// Stress-tests the ordering guarantee: default-group item comes first in source array
			const media = makeCollection({ slug: 'media' }); // maps to 'Collections' — inserted first
			const posts = makeCollection({ slug: 'posts', admin: { group: 'Content' } });
			const { component } = await setupWithCollections([media, posts]);

			const groupNames = component.collectionGroups().map((g) => g.name);
			expect(groupNames).toEqual(['Content', 'Collections']);
		});

		it('should not emit a Collections group when every collection has an explicit admin.group', async () => {
			// Covers the `if (defaultGroup) groups.push(...)` guard in the implementation
			const a = makeCollection({ slug: 'posts', admin: { group: 'Content' } });
			const b = makeCollection({ slug: 'articles', admin: { group: 'Content' } });
			const { component } = await setupWithCollections([a, b]);

			const groupNames = component.collectionGroups().map((g) => g.name);
			expect(groupNames).not.toContain('Collections');
		});

		it('should preserve insertion order of collections within a group', async () => {
			const a = makeCollection({ slug: 'posts', admin: { group: 'Content' } });
			const b = makeCollection({ slug: 'articles', admin: { group: 'Content' } });
			const { component } = await setupWithCollections([a, b]);

			const group = component.collectionGroups().find((g) => g.name === 'Content');
			expect(group?.collections.map((c) => c.slug)).toEqual(['posts', 'articles']);
		});

		it('should exclude hidden collections from groups', async () => {
			const visible = makeCollection({ slug: 'posts', admin: { group: 'Content' } });
			const hidden = makeCollection({ slug: 'drafts', admin: { group: 'Content', hidden: true } });
			const { component } = await setupWithCollections([visible, hidden]);

			const group = component.collectionGroups().find((g) => g.name === 'Content');
			expect(group?.collections.map((c) => c.slug)).toEqual(['posts']);
		});

		it('should not create a group when all its members are hidden', async () => {
			const hidden = makeCollection({ slug: 'session', admin: { group: 'Auth', hidden: true } });
			const { component } = await setupWithCollections([hidden]);

			expect(component.collectionGroups()).toHaveLength(0);
		});

		it('should only include accessible collections after permissions load', async () => {
			const a = makeCollection({ slug: 'posts', admin: { group: 'Content' } });
			const b = makeCollection({ slug: 'articles', admin: { group: 'Content' } });
			const { component, initialized, accessibleCollections } = await setupWithCollections([a, b]);

			initialized.set(true);
			accessibleCollections.set(['posts']);

			const group = component.collectionGroups().find((g) => g.name === 'Content');
			expect(group?.collections.map((c) => c.slug)).toEqual(['posts']);
			expect(group?.collections.map((c) => c.slug)).not.toContain('articles');
		});

		it('should generate valid HTML IDs for groups with spaces in names', async () => {
			const a = makeCollection({ slug: 'pages', admin: { group: 'Content Management' } });
			const b = makeCollection({ slug: 'faq', admin: { group: 'Help & Support' } });
			const { component } = await setupWithCollections([a, b]);

			const groups = component.collectionGroups();
			for (const group of groups) {
				// HTML id attributes must not contain spaces
				expect(group.id).toBeDefined();
				expect(group.id).not.toMatch(/\s/);
				// The display name should still be the original
				expect(group.name).toBeTruthy();
			}
			// Verify specific slugification
			const contentGroup = groups.find((g) => g.name === 'Content Management');
			expect(contentGroup?.id).toBe('group-content-management');
			const helpGroup = groups.find((g) => g.name === 'Help & Support');
			expect(helpGroup?.id).toBe('group-help-support');
		});

		it('should remove a group entirely when permissions revoke access to all its members', async () => {
			const a = makeCollection({ slug: 'posts', admin: { group: 'Content' } });
			const b = makeCollection({ slug: 'articles', admin: { group: 'Content' } });
			const c = makeCollection({ slug: 'users', admin: { group: 'Auth' } });
			const { component, initialized, accessibleCollections } = await setupWithCollections([
				a,
				b,
				c,
			]);

			// Only 'users' is accessible — Content group loses all members
			initialized.set(true);
			accessibleCollections.set(['users']);

			const groupNames = component.collectionGroups().map((g) => g.name);
			expect(groupNames).not.toContain('Content');
			expect(groupNames).toEqual(['Auth']);
		});
	});
});

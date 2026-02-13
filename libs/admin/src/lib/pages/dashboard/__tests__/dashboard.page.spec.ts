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
import type { CollectionConfig } from '@momentum-cms/core';
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
});

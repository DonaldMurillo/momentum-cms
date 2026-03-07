import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Type } from '@angular/core';
import { ActivatedRoute, Data, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AdminPageResolver } from '../admin-page-resolver.component';
import { AdminComponentRegistry } from '../../../services/admin-component-registry.service';
import type { HasUnsavedChanges } from '../../../guards/unsaved-changes.guard';

@Component({ template: '<div data-testid="custom-dashboard">Custom Dashboard</div>' })
class CustomDashboard {}

@Component({ template: '<div data-testid="default-dashboard">Default Dashboard</div>' })
class DefaultDashboard {}

@Component({ template: '<div data-testid="custom-articles-list">Custom Articles List</div>' })
class CustomArticlesList {}

@Component({ template: '<div data-testid="default-list">Default List</div>' })
class DefaultList {}

@Component({ template: '<div>Dirty Edit</div>' })
class DirtyEditPage implements HasUnsavedChanges {
	dirty = false;
	hasUnsavedChanges(): boolean {
		return this.dirty;
	}
}

@Component({ template: '<div>Simple Page</div>' })
class SimplePage {}

/**
 * Creates a mock ActivatedRoute with observable data/params that can be
 * updated to simulate navigation between routes.
 */
function createMockRoute(
	data: Record<string, unknown>,
	params?: Record<string, string>,
): {
	provider: { provide: typeof ActivatedRoute; useValue: unknown };
	data$: BehaviorSubject<Data>;
	params$: BehaviorSubject<Params>;
} {
	const data$ = new BehaviorSubject<Data>(data);
	const params$ = new BehaviorSubject<Params>(params ?? {});
	return {
		provider: {
			provide: ActivatedRoute,
			useValue: {
				data: data$,
				params: params$,
				snapshot: { data, params: params ?? {} },
			},
		},
		data$,
		params$,
	};
}

/** Flush microtask queue and trigger change detection. */
async function flushAndDetect(fixture: ComponentFixture<unknown>): Promise<void> {
	await new Promise((r) => setTimeout(r, 0));
	fixture.detectChanges();
}

describe('AdminPageResolver', () => {
	let registry: AdminComponentRegistry;

	afterEach(() => TestBed.resetTestingModule());

	it('should create', () => {
		const { provider } = createMockRoute({
			adminPageKey: 'dashboard',
			adminPageFallback: () => Promise.resolve(DefaultDashboard),
		});
		TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
		const fixture = TestBed.createComponent(AdminPageResolver);
		fixture.detectChanges();
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should render the built-in fallback when no override is registered', async () => {
		const { provider } = createMockRoute({
			adminPageKey: 'dashboard',
			adminPageFallback: () => Promise.resolve(DefaultDashboard),
		});
		TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
		const fixture = TestBed.createComponent(AdminPageResolver);
		fixture.detectChanges();
		await flushAndDetect(fixture);
		expect(fixture.nativeElement.querySelector('[data-testid="default-dashboard"]')).toBeTruthy();
	});

	it('should render the registered override when available', async () => {
		const { provider } = createMockRoute({
			adminPageKey: 'dashboard',
			adminPageFallback: () => Promise.resolve(DefaultDashboard),
		});
		TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
		registry = TestBed.inject(AdminComponentRegistry);
		registry.register('dashboard', () => Promise.resolve(CustomDashboard as Type<unknown>));
		const fixture = TestBed.createComponent(AdminPageResolver);
		fixture.detectChanges();
		await flushAndDetect(fixture);
		expect(fixture.nativeElement.querySelector('[data-testid="custom-dashboard"]')).toBeTruthy();
	});

	it('should resolve per-collection overrides for collection pages', async () => {
		const { provider } = createMockRoute(
			{ adminPageKey: 'collection-list', adminPageFallback: () => Promise.resolve(DefaultList) },
			{ slug: 'articles' },
		);
		TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
		registry = TestBed.inject(AdminComponentRegistry);
		registry.register('collections/articles/list', () =>
			Promise.resolve(CustomArticlesList as Type<unknown>),
		);
		const fixture = TestBed.createComponent(AdminPageResolver);
		fixture.detectChanges();
		await flushAndDetect(fixture);
		expect(
			fixture.nativeElement.querySelector('[data-testid="custom-articles-list"]'),
		).toBeTruthy();
	});

	it('should fall back to global override when per-collection is not registered', async () => {
		const { provider } = createMockRoute(
			{ adminPageKey: 'collection-list', adminPageFallback: () => Promise.resolve(DefaultList) },
			{ slug: 'articles' },
		);
		TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
		registry = TestBed.inject(AdminComponentRegistry);
		registry.register('collection-list', () => Promise.resolve(CustomDashboard as Type<unknown>));
		const fixture = TestBed.createComponent(AdminPageResolver);
		fixture.detectChanges();
		await flushAndDetect(fixture);
		expect(fixture.nativeElement.querySelector('[data-testid="custom-dashboard"]')).toBeTruthy();
	});

	it('should fall back to built-in default when nothing is registered', async () => {
		const { provider } = createMockRoute(
			{ adminPageKey: 'collection-list', adminPageFallback: () => Promise.resolve(DefaultList) },
			{ slug: 'articles' },
		);
		TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
		const fixture = TestBed.createComponent(AdminPageResolver);
		fixture.detectChanges();
		await flushAndDetect(fixture);
		expect(fixture.nativeElement.querySelector('[data-testid="default-list"]')).toBeTruthy();
	});

	it('should re-resolve when route params change (e.g., navigating between collections)', async () => {
		const { provider, data$, params$ } = createMockRoute(
			{ adminPageKey: 'collection-list', adminPageFallback: () => Promise.resolve(DefaultList) },
			{ slug: 'articles' },
		);
		TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
		registry = TestBed.inject(AdminComponentRegistry);
		registry.register('collections/articles/list', () =>
			Promise.resolve(CustomArticlesList as Type<unknown>),
		);
		const fixture = TestBed.createComponent(AdminPageResolver);
		fixture.detectChanges();
		await flushAndDetect(fixture);

		// Verify custom articles list is rendered
		expect(
			fixture.nativeElement.querySelector('[data-testid="custom-articles-list"]'),
		).toBeTruthy();

		// Simulate navigating to a different collection (categories) with no custom override
		params$.next({ slug: 'categories' });
		data$.next({
			adminPageKey: 'collection-list',
			adminPageFallback: () => Promise.resolve(DefaultList),
		});
		fixture.detectChanges();
		await flushAndDetect(fixture);

		// Should now show the default list, NOT the custom articles list
		expect(fixture.nativeElement.querySelector('[data-testid="default-list"]')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('[data-testid="custom-articles-list"]')).toBeFalsy();
	});

	it('should re-resolve when navigating from default to custom page', async () => {
		const { provider, data$, params$ } = createMockRoute(
			{ adminPageKey: 'collection-list', adminPageFallback: () => Promise.resolve(DefaultList) },
			{ slug: 'categories' },
		);
		TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
		registry = TestBed.inject(AdminComponentRegistry);
		registry.register('collections/articles/list', () =>
			Promise.resolve(CustomArticlesList as Type<unknown>),
		);
		const fixture = TestBed.createComponent(AdminPageResolver);
		fixture.detectChanges();
		await flushAndDetect(fixture);

		// Starts with default list for categories
		expect(fixture.nativeElement.querySelector('[data-testid="default-list"]')).toBeTruthy();

		// Navigate to articles (has custom override)
		params$.next({ slug: 'articles' });
		data$.next({
			adminPageKey: 'collection-list',
			adminPageFallback: () => Promise.resolve(DefaultList),
		});
		fixture.detectChanges();
		await flushAndDetect(fixture);

		// Should now show custom articles list
		expect(
			fixture.nativeElement.querySelector('[data-testid="custom-articles-list"]'),
		).toBeTruthy();
		expect(fixture.nativeElement.querySelector('[data-testid="default-list"]')).toBeFalsy();
	});

	describe('HasUnsavedChanges delegation', () => {
		it('should return false when resolved component does not implement HasUnsavedChanges', async () => {
			const { provider } = createMockRoute({
				adminPageKey: 'dashboard',
				adminPageFallback: () => Promise.resolve(SimplePage),
			});
			TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
			const fixture = TestBed.createComponent(AdminPageResolver);
			fixture.detectChanges();
			await flushAndDetect(fixture);

			expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
		});

		it('should delegate to resolved component when it implements HasUnsavedChanges', async () => {
			const { provider } = createMockRoute({
				adminPageKey: 'collection-edit',
				adminPageFallback: () => Promise.resolve(DirtyEditPage),
			});
			TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
			const fixture = TestBed.createComponent(AdminPageResolver);
			fixture.detectChanges();
			await flushAndDetect(fixture);

			// Initially not dirty
			expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
		});

		it('should return false when no component is resolved yet', () => {
			const { provider } = createMockRoute({
				adminPageKey: 'dashboard',
				adminPageFallback: () =>
					new Promise((_resolve) => {
						/* intentionally never resolves */
					}),
			});
			TestBed.configureTestingModule({ imports: [AdminPageResolver], providers: [provider] });
			const fixture = TestBed.createComponent(AdminPageResolver);
			fixture.detectChanges();

			expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
		});
	});
});

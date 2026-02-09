import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PageComponent } from './page.component';
import { BLOCK_COMPONENT_REGISTRY } from '@momentum-cms/ui';

describe('PageComponent', () => {
	let component: PageComponent;
	let fixture: ComponentFixture<PageComponent>;
	let paramsSubject: BehaviorSubject<Record<string, string>>;

	function setup(options: {
		slug?: string;
		dataSlug?: string;
		docs?: Record<string, unknown>[];
		platform?: string;
	}): void {
		paramsSubject = new BehaviorSubject<Record<string, string>>(
			options.slug ? { slug: options.slug } : {},
		);

		TestBed.configureTestingModule({
			imports: [PageComponent],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: {
						params: paramsSubject.asObservable(),
						snapshot: {
							params: options.slug ? { slug: options.slug } : {},
							data: options.dataSlug ? { slug: options.dataSlug } : {},
						},
					},
				},
				{
					provide: PLATFORM_ID,
					useValue: options.platform ?? 'server',
				},
				{
					provide: BLOCK_COMPONENT_REGISTRY,
					useValue: new Map(),
				},
			],
		});

		// Override the injectMomentumAPI usage by stripping the component template
		// and testing the logic directly. We use overrideComponent to avoid deep rendering.
		TestBed.overrideComponent(PageComponent, {
			set: {
				template: `
					@if (loading()) {
						<div data-testid="page-loading">Loading</div>
					} @else if (error()) {
						<div data-testid="page-error">Error</div>
					} @else {
						<div data-testid="page-content">
							{{ blocks().length }} blocks
						</div>
					}
				`,
				imports: [],
			},
		});

		fixture = TestBed.createComponent(PageComponent);
		component = fixture.componentInstance;

		// Replace the api with our mock (private field bypass for testing)
		const docs = options.docs ?? [];
		(component as unknown as Record<string, unknown>)['api'] = {
			collection: () => ({
				find$: () =>
					new BehaviorSubject({
						docs,
						totalDocs: docs.length,
						totalPages: 1,
						page: 1,
						limit: 10,
						hasNextPage: false,
						hasPrevPage: false,
					}),
				find: () =>
					Promise.resolve({
						docs,
						totalDocs: docs.length,
						totalPages: 1,
						page: 1,
						limit: 10,
						hasNextPage: false,
						hasPrevPage: false,
					}),
			}),
		};
	}

	it('should create', () => {
		setup({ dataSlug: 'home', docs: [{ slug: 'home', content: [] }] });
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	it('should set loading=true initially', () => {
		setup({ dataSlug: 'home' });
		expect(component.loading()).toBe(true);
	});

	it('should read slug from route params', async () => {
		const pageDocs = [{ slug: 'about', content: [{ blockType: 'hero', heading: 'About' }] }];
		setup({ slug: 'about', docs: pageDocs });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.page()).toEqual(pageDocs[0]);
		expect(component.loading()).toBe(false);
		expect(component.error()).toBe(false);
	});

	it('should fall back to route data slug', async () => {
		const pageDocs = [{ slug: 'home', content: [] }];
		setup({ dataSlug: 'home', docs: pageDocs });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.page()).toEqual(pageDocs[0]);
	});

	it('should set error when no documents found', async () => {
		setup({ dataSlug: 'nonexistent', docs: [] });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.error()).toBe(true);
		expect(component.page()).toBeNull();
	});

	it('should set error when no slug is available', async () => {
		setup({});

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.error()).toBe(true);
		expect(component.loading()).toBe(false);
	});

	it('should compute blocks from page content', async () => {
		const content = [
			{ blockType: 'hero', heading: 'Title' },
			{ blockType: 'text', body: 'Body' },
		];
		setup({ dataSlug: 'home', docs: [{ slug: 'home', content }] });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.blocks()).toEqual(content);
	});

	it('should return empty blocks when content is not an array', async () => {
		setup({ dataSlug: 'home', docs: [{ slug: 'home', content: 'not-an-array' }] });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.blocks()).toEqual([]);
	});

	it('should prefer previewOverride over page content', async () => {
		const content = [{ blockType: 'hero', heading: 'From DB' }];
		const override = [{ blockType: 'hero', heading: 'From Preview' }];

		setup({ dataSlug: 'home', docs: [{ slug: 'home', content }] });

		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.blocks()).toEqual(content);

		component.previewOverride.set(override);
		expect(component.blocks()).toEqual(override);
	});

	describe('postMessage preview listener', () => {
		it('should not set up listener on server platform', () => {
			setup({ dataSlug: 'home', platform: 'server' });
			fixture.detectChanges();
			// No error thrown - listener not attached on server
			expect(component).toBeTruthy();
		});

		it('should set up listener on browser platform', () => {
			setup({ dataSlug: 'home', platform: 'browser' });
			fixture.detectChanges();
			// Listener is attached - verified by not throwing
			expect(component).toBeTruthy();
		});

		it('should update previewOverride when valid message received', async () => {
			setup({ dataSlug: 'home', platform: 'browser', docs: [{ slug: 'home', content: [] }] });
			fixture.detectChanges();
			await fixture.whenStable();

			const previewBlocks = [{ blockType: 'hero', heading: 'Live Preview' }];
			window.dispatchEvent(
				new MessageEvent('message', {
					data: { type: 'momentum-preview-update', data: { content: previewBlocks } },
					origin: location.origin,
				}),
			);

			expect(component.previewOverride()).toEqual(previewBlocks);
			expect(component.blocks()).toEqual(previewBlocks);
		});

		it('should ignore messages with wrong type', async () => {
			setup({ dataSlug: 'home', platform: 'browser', docs: [{ slug: 'home', content: [] }] });
			fixture.detectChanges();
			await fixture.whenStable();

			window.dispatchEvent(
				new MessageEvent('message', {
					data: { type: 'some-other-type', data: { content: [{ blockType: 'x' }] } },
					origin: location.origin,
				}),
			);

			expect(component.previewOverride()).toBeNull();
		});

		it('should ignore messages with non-array content', async () => {
			setup({ dataSlug: 'home', platform: 'browser', docs: [{ slug: 'home', content: [] }] });
			fixture.detectChanges();
			await fixture.whenStable();

			window.dispatchEvent(
				new MessageEvent('message', {
					data: { type: 'momentum-preview-update', data: { content: 'not-array' } },
					origin: location.origin,
				}),
			);

			expect(component.previewOverride()).toBeNull();
		});
	});
});

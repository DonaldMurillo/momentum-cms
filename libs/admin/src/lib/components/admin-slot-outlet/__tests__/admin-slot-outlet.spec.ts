import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Type } from '@angular/core';
import { AdminSlotOutlet } from '../admin-slot-outlet.component';
import { AdminSlotRegistry } from '../../../services/admin-slot-registry.service';

@Component({ template: '<div data-testid="banner">Banner</div>' })
class BannerComponent {}

@Component({ template: '<div data-testid="footer">Footer</div>' })
class FooterComponent {}

/** Flush microtask queue and trigger change detection. */
async function flushAndDetect(fixture: ComponentFixture<unknown>): Promise<void> {
	await new Promise((r) => setTimeout(r, 0));
	fixture.detectChanges();
}

describe('AdminSlotOutlet', () => {
	let fixture: ComponentFixture<AdminSlotOutlet>;
	let registry: AdminSlotRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [AdminSlotOutlet],
		});
		registry = TestBed.inject(AdminSlotRegistry);
	});

	function createComponent(slot: string, slug?: string): ComponentFixture<AdminSlotOutlet> {
		fixture = TestBed.createComponent(AdminSlotOutlet);
		fixture.componentRef.setInput('slot', slot);
		if (slug) {
			fixture.componentRef.setInput('collectionSlug', slug);
		}
		fixture.detectChanges();
		return fixture;
	}

	it('should create', () => {
		createComponent('dashboard:before');
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should render nothing when no loaders are registered', async () => {
		createComponent('dashboard:before');
		await flushAndDetect(fixture);
		expect(fixture.nativeElement.children.length).toBe(0);
	});

	it('should resolve and render registered slot components', async () => {
		registry.register('dashboard:before', () => Promise.resolve(BannerComponent as Type<unknown>));
		createComponent('dashboard:before');

		await flushAndDetect(fixture);

		expect(fixture.nativeElement.querySelector('[data-testid="banner"]')).toBeTruthy();
	});

	it('should render multiple components for the same slot', async () => {
		registry.register('dashboard:before', () => Promise.resolve(BannerComponent as Type<unknown>));
		registry.register('dashboard:before', () => Promise.resolve(FooterComponent as Type<unknown>));
		createComponent('dashboard:before');

		await flushAndDetect(fixture);

		expect(fixture.nativeElement.querySelector('[data-testid="banner"]')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('[data-testid="footer"]')).toBeTruthy();
	});

	it('should merge global and per-collection loaders', async () => {
		registry.register('collection-list:before', () =>
			Promise.resolve(BannerComponent as Type<unknown>),
		);
		registry.register('collection-list:before:articles', () =>
			Promise.resolve(FooterComponent as Type<unknown>),
		);
		createComponent('collection-list:before', 'articles');

		await flushAndDetect(fixture);

		expect(fixture.nativeElement.querySelector('[data-testid="banner"]')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('[data-testid="footer"]')).toBeTruthy();
	});

	it('should have contents host class for layout transparency', () => {
		createComponent('dashboard:before');
		expect(fixture.nativeElement.classList.contains('contents')).toBe(true);
	});
});

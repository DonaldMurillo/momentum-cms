import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Type } from '@angular/core';
import { vi } from 'vitest';
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

	it('should not use contents host class (CLAUDE.md: breaks height inheritance)', () => {
		createComponent('dashboard:before');
		expect(fixture.nativeElement.classList.contains('contents')).toBe(false);
	});

	it('should not render stale components when slot input changes rapidly', async () => {
		// Register a slow loader for slot A and a fast loader for slot B
		let resolveSlowLoader!: (value: unknown) => void;
		const slowPromise = new Promise((resolve) => {
			resolveSlowLoader = resolve;
		});
		registry.register('slot-a', () => slowPromise);
		registry.register('slot-b', () => Promise.resolve(FooterComponent as Type<unknown>));

		// Start with slot A (slow)
		createComponent('slot-a');
		fixture.detectChanges();

		// Switch to slot B before slot A resolves
		fixture.componentRef.setInput('slot', 'slot-b');
		fixture.detectChanges();
		await flushAndDetect(fixture);

		// Slot B should be showing
		expect(fixture.nativeElement.querySelector('[data-testid="footer"]')).toBeTruthy();

		// Now slot A resolves — should NOT overwrite
		resolveSlowLoader(BannerComponent as Type<unknown>);
		await flushAndDetect(fixture);

		// Should still show footer (slot B), NOT banner (stale slot A)
		expect(fixture.nativeElement.querySelector('[data-testid="footer"]')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('[data-testid="banner"]')).toBeFalsy();
	});

	it('should handle loader errors gracefully', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());
		registry.register('dashboard:before', () => Promise.reject(new Error('Failed to load')));
		createComponent('dashboard:before');
		await flushAndDetect(fixture);

		// Should reset to empty on error, not leave stale components
		expect(fixture.componentInstance.resolvedComponents()).toEqual([]);
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it('should re-render when a slot is registered after component creation', async () => {
		createComponent('dashboard:before');
		await flushAndDetect(fixture);

		// No components initially
		expect(fixture.nativeElement.querySelector('[data-testid="banner"]')).toBeFalsy();

		// Register a slot after the component is already created
		registry.register('dashboard:before', () => Promise.resolve(BannerComponent as Type<unknown>));
		fixture.detectChanges();
		await flushAndDetect(fixture);

		// Should now render the banner
		expect(fixture.nativeElement.querySelector('[data-testid="banner"]')).toBeTruthy();
	});
});

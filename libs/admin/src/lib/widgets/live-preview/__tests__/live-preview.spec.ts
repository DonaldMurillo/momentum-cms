/**
 * Comprehensive unit tests for LivePreviewComponent.
 *
 * Tests computed signals (containerWidth), device size toggling,
 * refresh mechanics, component lazy loading, and error handling.
 *
 * Uses TestBed.overrideComponent to strip the template and avoid
 * rendering NgComponentOutlet in jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LivePreviewComponent } from '../live-preview.component';
import type { PreviewConfig } from '@momentumcms/core';

describe('LivePreviewComponent', () => {
	let fixture: ComponentFixture<LivePreviewComponent>;
	let component: LivePreviewComponent;

	class MockPreviewComponent {}

	const mockConfig: PreviewConfig = {
		component: () => Promise.resolve(MockPreviewComponent),
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [LivePreviewComponent],
		}).compileComponents();

		TestBed.overrideComponent(LivePreviewComponent, {
			set: { template: '<div></div>', imports: [] },
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function createComponent(preview: PreviewConfig = mockConfig): void {
		fixture = TestBed.createComponent(LivePreviewComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('preview', preview);
		fixture.detectChanges();
	}

	// ---------------------------------------------------------------
	// containerWidth computed
	// ---------------------------------------------------------------
	describe('containerWidth computed', () => {
		it('should return "100%" for desktop (default)', () => {
			createComponent();
			expect(component.containerWidth()).toBe('100%');
		});

		it('should return "768px" for tablet', () => {
			createComponent();
			component.deviceSize.set('tablet');
			expect(component.containerWidth()).toBe('768px');
		});

		it('should return "375px" for mobile', () => {
			createComponent();
			component.deviceSize.set('mobile');
			expect(component.containerWidth()).toBe('375px');
		});

		it('should reactively update when deviceSize changes', () => {
			createComponent();

			expect(component.containerWidth()).toBe('100%');

			component.deviceSize.set('mobile');
			expect(component.containerWidth()).toBe('375px');

			component.deviceSize.set('tablet');
			expect(component.containerWidth()).toBe('768px');

			component.deviceSize.set('desktop');
			expect(component.containerWidth()).toBe('100%');
		});
	});

	// ---------------------------------------------------------------
	// deviceSize signal
	// ---------------------------------------------------------------
	describe('deviceSize signal', () => {
		it('should default to "desktop"', () => {
			createComponent();
			expect(component.deviceSize()).toBe('desktop');
		});

		it('should be settable to "tablet"', () => {
			createComponent();
			component.deviceSize.set('tablet');
			expect(component.deviceSize()).toBe('tablet');
		});

		it('should be settable to "mobile"', () => {
			createComponent();
			component.deviceSize.set('mobile');
			expect(component.deviceSize()).toBe('mobile');
		});

		it('should be settable back to "desktop" from another size', () => {
			createComponent();
			component.deviceSize.set('mobile');
			expect(component.deviceSize()).toBe('mobile');

			component.deviceSize.set('desktop');
			expect(component.deviceSize()).toBe('desktop');
		});
	});

	// ---------------------------------------------------------------
	// Component lazy loading
	// ---------------------------------------------------------------
	describe('component lazy loading', () => {
		it('should resolve the component from the preview config', async () => {
			createComponent();
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.resolvedComponent()).toBe(MockPreviewComponent);
		});

		it('should start with null resolvedComponent', () => {
			createComponent();
			// Immediately after creation, the component hasn't loaded yet
			// (it's in an effect that runs async)
			expect(component.resolvedComponent()).toBeNull();
		});

		it('should set loadError when component loader rejects', async () => {
			const error = new Error('Component not found');
			createComponent({
				component: () => Promise.reject(error),
			});
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.resolvedComponent()).toBeNull();
			expect(component.loadError()).toBe(error);
		});

		it('should have null loadError on successful load', async () => {
			createComponent();
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.loadError()).toBeNull();
		});

		it('should ignore stale resolutions after refresh', async () => {
			let resolveFirst: (value: unknown) => void = (_v: unknown) => {
				/* placeholder */
			};
			const slowConfig: PreviewConfig = {
				component: () =>
					new Promise((resolve) => {
						resolveFirst = resolve;
					}),
			};
			createComponent(slowConfig);

			// Trigger refresh before first load completes
			component.refreshPreview();

			// Now resolve the first (stale) load
			resolveFirst(MockPreviewComponent);
			await new Promise((resolve) => setTimeout(resolve, 10));

			// The stale resolution should be ignored (generation mismatch)
			// The second load from refresh is also pending
			// resolvedComponent should still be null (both loads were stale or second is pending)
			expect(component.resolvedComponent()).toBeNull();
		});
	});

	// ---------------------------------------------------------------
	// refreshPreview
	// ---------------------------------------------------------------
	describe('refreshPreview', () => {
		it('should re-resolve the component after refresh', async () => {
			createComponent();
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.resolvedComponent()).toBe(MockPreviewComponent);

			component.refreshPreview();
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.resolvedComponent()).toBe(MockPreviewComponent);
		});

		it('should be callable multiple times', async () => {
			createComponent();
			await new Promise((resolve) => setTimeout(resolve, 10));

			component.refreshPreview();
			component.refreshPreview();
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(component.resolvedComponent()).toBe(MockPreviewComponent);
		});
	});

	// ---------------------------------------------------------------
	// Component creation
	// ---------------------------------------------------------------
	describe('component creation', () => {
		it('should create the component successfully', () => {
			createComponent();
			expect(component).toBeTruthy();
		});

		it('should expose deviceSize as a writable signal', () => {
			createComponent();
			expect(typeof component.deviceSize).toBe('function');
			expect(typeof component.deviceSize.set).toBe('function');
		});

		it('should expose containerWidth as a computed signal', () => {
			createComponent();
			expect(typeof component.containerWidth).toBe('function');
		});

		it('should expose resolvedComponent as a writable signal', () => {
			createComponent();
			expect(typeof component.resolvedComponent).toBe('function');
		});

		it('should expose loadError as a writable signal', () => {
			createComponent();
			expect(typeof component.loadError).toBe('function');
		});
	});
});

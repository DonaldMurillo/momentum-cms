import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LivePreviewComponent } from './live-preview.component';
import type { PreviewConfig } from '@momentumcms/core';

describe('LivePreviewComponent', () => {
	let fixture: ComponentFixture<LivePreviewComponent>;
	let component: LivePreviewComponent;

	class MockPreview {}

	const mockPreviewConfig: PreviewConfig = {
		component: () => Promise.resolve(MockPreview),
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [LivePreviewComponent],
		}).compileComponents();

		TestBed.overrideComponent(LivePreviewComponent, {
			set: { template: '<div></div>', imports: [] },
		});
	});

	function createFixture(preview: PreviewConfig = mockPreviewConfig): void {
		fixture = TestBed.createComponent(LivePreviewComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('preview', preview);
		fixture.detectChanges();
	}

	describe('containerWidth', () => {
		it('should return 100% for desktop', () => {
			createFixture();
			expect(component.containerWidth()).toBe('100%');
		});

		it('should return 768px for tablet', () => {
			createFixture();
			component.deviceSize.set('tablet');
			expect(component.containerWidth()).toBe('768px');
		});

		it('should return 375px for mobile', () => {
			createFixture();
			component.deviceSize.set('mobile');
			expect(component.containerWidth()).toBe('375px');
		});
	});

	describe('deviceSize', () => {
		it('should default to desktop', () => {
			createFixture();
			expect(component.deviceSize()).toBe('desktop');
		});
	});

	describe('resolvedComponent', () => {
		it('should resolve the component from the preview config', async () => {
			createFixture();
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.resolvedComponent()).toBe(MockPreview);
		});

		it('should set loadError on failure', async () => {
			const error = new Error('fail');
			createFixture({
				component: () => Promise.reject(error),
			});
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.resolvedComponent()).toBeNull();
			expect(component.loadError()).toBe(error);
		});
	});

	describe('refreshPreview', () => {
		it('should re-resolve the component after refresh', async () => {
			createFixture();
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.resolvedComponent()).toBe(MockPreview);

			component.refreshPreview();
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(component.resolvedComponent()).toBe(MockPreview);
		});
	});
});

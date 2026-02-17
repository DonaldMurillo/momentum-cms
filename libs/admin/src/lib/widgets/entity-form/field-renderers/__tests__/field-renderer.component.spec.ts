import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { FieldRenderer } from '../field-renderer.component';
import { FieldRendererRegistry } from '../../../../services/field-renderer-registry.service';
import type { Field } from '@momentumcms/core';

function createTextField(overrides?: Partial<Field>): Field {
	return {
		name: 'title',
		type: 'text',
		...overrides,
	} as Field;
}

describe('FieldRenderer', () => {
	let fixture: ComponentFixture<FieldRenderer>;
	let registry: FieldRendererRegistry;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldRenderer],
		}).compileComponents();

		registry = TestBed.inject(FieldRendererRegistry);
	});

	// ── Task #3: Loading skeleton ARIA attributes ──────────────────

	describe('loading skeleton accessibility', () => {
		it('should render loading skeleton with role="status"', () => {
			// Don't register any renderer — component stays in loading state
			fixture = TestBed.createComponent(FieldRenderer);
			fixture.componentRef.setInput('field', createTextField());
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			const skeleton = fixture.nativeElement.querySelector('[role="status"]');
			expect(skeleton).toBeTruthy();
		});

		it('should render loading skeleton with aria-label', () => {
			fixture = TestBed.createComponent(FieldRenderer);
			fixture.componentRef.setInput('field', createTextField());
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			const skeleton = fixture.nativeElement.querySelector('[aria-label]');
			expect(skeleton).toBeTruthy();
			expect(skeleton.getAttribute('aria-label')).toContain('Loading');
		});
	});

	// ── Task #4: Unhandled promise rejection ───────────────────────

	describe('error handling', () => {
		it('should handle loader rejection without unhandled promise', async () => {
			const error = new Error('chunk load failed');
			registry.register('text', () => Promise.reject(error));

			fixture = TestBed.createComponent(FieldRenderer);
			fixture.componentRef.setInput('field', createTextField());
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			// Wait for the rejected promise to settle
			await vi.waitFor(() => {
				fixture.detectChanges();
				// Component should still be in loading/error state, not crash
				expect(fixture.componentInstance.resolvedComponent()).toBeNull();
			});
		});

		it('should set loadError signal on loader rejection', async () => {
			const error = new Error('chunk load failed');
			registry.register('text', () => Promise.reject(error));

			fixture = TestBed.createComponent(FieldRenderer);
			fixture.componentRef.setInput('field', createTextField());
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			// Wait for the rejected promise to settle and error state to be set
			await vi.waitFor(() => {
				fixture.detectChanges();
				expect(fixture.componentInstance.loadError()).toBeTruthy();
			});
		});

		it('should show error message in template on load failure', async () => {
			registry.register('text', () => Promise.reject(new Error('fail')));

			fixture = TestBed.createComponent(FieldRenderer);
			fixture.componentRef.setInput('field', createTextField());
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			await vi.waitFor(() => {
				fixture.detectChanges();
				const errorEl = fixture.nativeElement.querySelector('[role="alert"]');
				expect(errorEl).toBeTruthy();
			});
		});
	});
});

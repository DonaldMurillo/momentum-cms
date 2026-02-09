import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Button } from './button.component';

// Test host using signals to avoid ExpressionChangedAfterItHasBeenChecked errors
@Component({
	template: `<button
		mcms-button
		[disabled]="disabled()"
		[loading]="loading()"
		[ariaLabel]="ariaLabel()"
		[size]="size()"
	>
		Click me
	</button>`,
	imports: [Button],
})
class ButtonTestHost {
	readonly disabled = signal(false);
	readonly loading = signal(false);
	readonly ariaLabel = signal<string | undefined>(undefined);
	readonly size = signal<'sm' | 'md' | 'lg' | 'icon'>('md');
}

@Component({
	template: `<a mcms-button [disabled]="disabled()" [loading]="loading()" href="/test">Link</a>`,
	imports: [Button],
})
class AnchorTestHost {
	readonly disabled = signal(false);
	readonly loading = signal(false);
}

describe('Button', () => {
	describe('as <button> element', () => {
		let fixture: ComponentFixture<ButtonTestHost>;
		let buttonEl: HTMLElement;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [ButtonTestHost],
			}).compileComponents();

			fixture = TestBed.createComponent(ButtonTestHost);
			fixture.detectChanges();
			await fixture.whenStable();
			buttonEl = fixture.nativeElement.querySelector('button[mcms-button]');
		});

		it('should create', () => {
			expect(buttonEl).toBeTruthy();
		});

		it('should not have disabled attributes when enabled', () => {
			expect(buttonEl.hasAttribute('disabled')).toBe(false);
			expect(buttonEl.getAttribute('aria-disabled')).toBeNull();
		});

		it('should set native disabled and aria-disabled when disabled', () => {
			fixture.componentInstance.disabled.set(true);
			fixture.detectChanges();

			expect(buttonEl.hasAttribute('disabled')).toBe(true);
			expect(buttonEl.getAttribute('aria-disabled')).toBe('true');
		});

		it('should set aria-busy when loading', () => {
			fixture.componentInstance.loading.set(true);
			fixture.detectChanges();

			expect(buttonEl.getAttribute('aria-busy')).toBe('true');
		});

		it('should be effectively disabled when loading', () => {
			fixture.componentInstance.loading.set(true);
			fixture.detectChanges();

			expect(buttonEl.hasAttribute('disabled')).toBe(true);
			expect(buttonEl.getAttribute('aria-disabled')).toBe('true');
		});

		it('should set aria-label for icon-only buttons', () => {
			fixture.componentInstance.ariaLabel.set('Settings');
			fixture.detectChanges();

			expect(buttonEl.getAttribute('aria-label')).toBe('Settings');
		});

		it('should not set aria-label when not provided', () => {
			expect(buttonEl.getAttribute('aria-label')).toBeNull();
		});

		it('should have focus-visible styles via CSS', () => {
			buttonEl.focus();
			expect(document.activeElement).toBe(buttonEl);
		});
	});

	describe('as <a> element', () => {
		let fixture: ComponentFixture<AnchorTestHost>;
		let anchorEl: HTMLElement;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [AnchorTestHost],
			}).compileComponents();

			fixture = TestBed.createComponent(AnchorTestHost);
			fixture.detectChanges();
			await fixture.whenStable();
			anchorEl = fixture.nativeElement.querySelector('a[mcms-button]');
		});

		it('should not set native disabled on <a> elements', () => {
			fixture.componentInstance.disabled.set(true);
			fixture.detectChanges();

			// <a> elements don't support the disabled attribute
			expect(anchorEl.hasAttribute('disabled')).toBe(false);
		});

		it('should set aria-disabled on <a> elements when disabled', () => {
			fixture.componentInstance.disabled.set(true);
			fixture.detectChanges();

			expect(anchorEl.getAttribute('aria-disabled')).toBe('true');
		});

		it('should set aria-disabled on <a> elements when loading', () => {
			fixture.componentInstance.loading.set(true);
			fixture.detectChanges();

			expect(anchorEl.getAttribute('aria-disabled')).toBe('true');
			expect(anchorEl.getAttribute('aria-busy')).toBe('true');
		});

		it('should not have aria-disabled when enabled', () => {
			expect(anchorEl.getAttribute('aria-disabled')).toBeNull();
		});
	});
});

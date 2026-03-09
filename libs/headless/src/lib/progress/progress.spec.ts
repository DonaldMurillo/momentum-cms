import { TestBed } from '@angular/core/testing';
import { HdlProgress } from './progress.component';

describe('HdlProgress', () => {
	it('should expose progress semantics and state', () => {
		const fixture = TestBed.createComponent(HdlProgress);
		fixture.componentRef.setInput('value', 45);
		fixture.detectChanges();

		const progress = fixture.nativeElement as HTMLElement;
		expect(progress.getAttribute('aria-valuenow')).toBe('45');
		expect(progress.getAttribute('data-state')).toBe('loading');
	});

	it('should omit value semantics when indeterminate', () => {
		const fixture = TestBed.createComponent(HdlProgress);
		fixture.componentRef.setInput('indeterminate', true);
		fixture.detectChanges();

		const progress = fixture.nativeElement as HTMLElement;
		expect(progress.hasAttribute('aria-valuenow')).toBe(false);
		expect(progress.getAttribute('data-state')).toBe('indeterminate');
	});
});

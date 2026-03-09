import { TestBed } from '@angular/core/testing';
import { HdlSpinner } from './spinner.component';

describe('HdlSpinner', () => {
	it('should expose status semantics', () => {
		const fixture = TestBed.createComponent(HdlSpinner);
		fixture.detectChanges();

		const spinner = fixture.nativeElement as HTMLElement;
		expect(spinner.getAttribute('role')).toBe('status');
		expect(spinner.getAttribute('aria-label')).toBe('Loading');
	});
});

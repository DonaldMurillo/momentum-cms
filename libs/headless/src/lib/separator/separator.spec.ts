import { TestBed } from '@angular/core/testing';
import { HdlSeparator } from './separator.component';

describe('HdlSeparator', () => {
	it('should default to decorative separator', () => {
		const fixture = TestBed.createComponent(HdlSeparator);
		fixture.detectChanges();

		const separator = fixture.nativeElement as HTMLElement;
		expect(separator.getAttribute('role')).toBe('presentation');
		expect(separator.getAttribute('data-orientation')).toBe('horizontal');
	});
});

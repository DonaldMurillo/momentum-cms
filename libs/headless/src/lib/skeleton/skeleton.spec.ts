import { TestBed } from '@angular/core/testing';
import { HdlSkeleton } from './skeleton.component';

describe('HdlSkeleton', () => {
	it('should remain aria-hidden and expose state', () => {
		const fixture = TestBed.createComponent(HdlSkeleton);
		fixture.detectChanges();

		const skeleton = fixture.nativeElement as HTMLElement;
		expect(skeleton.getAttribute('aria-hidden')).toBe('true');
		expect(skeleton.getAttribute('data-state')).toBe('active');
	});
});

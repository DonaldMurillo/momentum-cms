import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Separator } from './separator.component';

describe('Separator', () => {
	let fixture: ComponentFixture<Separator>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Separator],
		}).compileComponents();

		fixture = TestBed.createComponent(Separator);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have horizontal orientation by default', () => {
		expect(fixture.componentInstance.orientation()).toBe('horizontal');
	});

	it('should be decorative by default', () => {
		expect(fixture.componentInstance.decorative()).toBe(true);
	});

	it('should have role="none" when decorative', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('none');
	});

	it('should have role="separator" when not decorative', () => {
		fixture.componentRef.setInput('decorative', false);
		fixture.detectChanges();
		expect(fixture.nativeElement.getAttribute('role')).toBe('separator');
	});

	it('should have aria-orientation when not decorative', () => {
		fixture.componentRef.setInput('decorative', false);
		fixture.detectChanges();
		expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');
	});

	it('should not have aria-orientation when decorative', () => {
		expect(fixture.nativeElement.getAttribute('aria-orientation')).toBeNull();
	});

	it('should apply horizontal classes by default', () => {
		expect(fixture.nativeElement.classList.contains('h-px')).toBe(true);
		expect(fixture.nativeElement.classList.contains('w-full')).toBe(true);
	});

	it('should apply vertical classes when orientation is vertical', () => {
		fixture.componentRef.setInput('orientation', 'vertical');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('h-full')).toBe(true);
		expect(fixture.nativeElement.classList.contains('w-px')).toBe(true);
	});

	it('should include custom classes', () => {
		fixture.componentRef.setInput('class', 'my-custom-class');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('my-custom-class')).toBe(true);
	});
});

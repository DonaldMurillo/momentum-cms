import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Spinner } from './spinner.component';

describe('Spinner', () => {
	let fixture: ComponentFixture<Spinner>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Spinner],
		}).compileComponents();

		fixture = TestBed.createComponent(Spinner);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="status"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('status');
	});

	it('should have default aria-label', () => {
		expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Loading');
	});

	it('should allow custom aria-label', () => {
		fixture.componentRef.setInput('label', 'Please wait');
		fixture.detectChanges();
		expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Please wait');
	});

	it('should have medium size by default', () => {
		expect(fixture.componentInstance.size()).toBe('md');
	});

	it('should render SVG element', () => {
		const svg = fixture.nativeElement.querySelector('svg');
		expect(svg).toBeTruthy();
	});

	it('should apply animate-spin class to SVG', () => {
		const svg = fixture.nativeElement.querySelector('svg');
		expect(svg.classList.contains('animate-spin')).toBe(true);
	});

	it('should change dimensions based on size', () => {
		const svg = fixture.nativeElement.querySelector('svg');

		// Default md
		expect(svg.getAttribute('width')).toBe('24');
		expect(svg.getAttribute('height')).toBe('24');

		// Small
		fixture.componentRef.setInput('size', 'sm');
		fixture.detectChanges();
		expect(svg.getAttribute('width')).toBe('16');
		expect(svg.getAttribute('height')).toBe('16');

		// Large
		fixture.componentRef.setInput('size', 'lg');
		fixture.detectChanges();
		expect(svg.getAttribute('width')).toBe('32');
		expect(svg.getAttribute('height')).toBe('32');
	});

	it('should include custom classes', () => {
		fixture.componentRef.setInput('class', 'my-spinner');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('my-spinner')).toBe(true);
	});
});

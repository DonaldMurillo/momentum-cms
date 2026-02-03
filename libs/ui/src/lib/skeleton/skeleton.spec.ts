import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Skeleton } from './skeleton.component';

describe('Skeleton', () => {
	let fixture: ComponentFixture<Skeleton>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Skeleton],
		}).compileComponents();

		fixture = TestBed.createComponent(Skeleton);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have aria-hidden="true"', () => {
		expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
	});

	it('should have animate-pulse class', () => {
		expect(fixture.nativeElement.classList.contains('animate-pulse')).toBe(true);
	});

	it('should have bg-muted class', () => {
		expect(fixture.nativeElement.classList.contains('bg-muted')).toBe(true);
	});

	it('should have rounded-md class', () => {
		expect(fixture.nativeElement.classList.contains('rounded-md')).toBe(true);
	});

	it('should include custom classes', () => {
		fixture.componentRef.setInput('class', 'h-4 w-32');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('h-4')).toBe(true);
		expect(fixture.nativeElement.classList.contains('w-32')).toBe(true);
	});

	it('should be a block element', () => {
		expect(fixture.nativeElement.classList.contains('block')).toBe(true);
	});
});

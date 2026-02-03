import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Progress } from './progress.component';

describe('Progress', () => {
	let fixture: ComponentFixture<Progress>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Progress],
		}).compileComponents();

		fixture = TestBed.createComponent(Progress);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="progressbar"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('progressbar');
	});

	it('should be indeterminate by default', () => {
		expect(fixture.componentInstance.isIndeterminate()).toBe(true);
	});

	it('should not have aria-valuenow when indeterminate', () => {
		expect(fixture.nativeElement.getAttribute('aria-valuenow')).toBeNull();
	});

	it('should have aria-valuemin="0"', () => {
		expect(fixture.nativeElement.getAttribute('aria-valuemin')).toBe('0');
	});

	it('should have aria-valuemax with default max', () => {
		expect(fixture.nativeElement.getAttribute('aria-valuemax')).toBe('100');
	});

	it('should show progress when value is set', () => {
		fixture.componentRef.setInput('value', 50);
		fixture.detectChanges();
		expect(fixture.componentInstance.isIndeterminate()).toBe(false);
		expect(fixture.nativeElement.getAttribute('aria-valuenow')).toBe('50');
	});

	it('should calculate progress width correctly', () => {
		fixture.componentRef.setInput('value', 75);
		fixture.detectChanges();
		expect(fixture.componentInstance.progressWidth()).toBe('75%');
	});

	it('should clamp progress width between 0 and 100', () => {
		fixture.componentRef.setInput('value', 150);
		fixture.detectChanges();
		expect(fixture.componentInstance.progressWidth()).toBe('100%');

		fixture.componentRef.setInput('value', -10);
		fixture.detectChanges();
		expect(fixture.componentInstance.progressWidth()).toBe('0%');
	});

	it('should use custom max value', () => {
		fixture.componentRef.setInput('max', 200);
		fixture.componentRef.setInput('value', 100);
		fixture.detectChanges();
		expect(fixture.nativeElement.getAttribute('aria-valuemax')).toBe('200');
		expect(fixture.componentInstance.progressWidth()).toBe('50%');
	});

	it('should render progress bar element', () => {
		const bar = fixture.nativeElement.querySelector('div');
		expect(bar).toBeTruthy();
		expect(bar.classList.contains('bg-primary')).toBe(true);
	});

	it('should apply indeterminate animation when value is null', () => {
		const bar = fixture.nativeElement.querySelector('div');
		expect(bar.classList.contains('animate-progress-indeterminate')).toBe(true);
	});

	it('should not apply indeterminate animation when value is set', () => {
		fixture.componentRef.setInput('value', 50);
		fixture.detectChanges();
		const bar = fixture.nativeElement.querySelector('div');
		expect(bar.classList.contains('animate-progress-indeterminate')).toBe(false);
	});

	it('should include custom classes', () => {
		fixture.componentRef.setInput('class', 'h-4');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('h-4')).toBe(true);
	});
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Alert } from './alert.component';
import { AlertDescription } from './alert-description.component';
import { AlertTitle } from './alert-title.component';
import type { AlertVariant } from './alert.types';

describe('Alert', () => {
	let component: Alert;
	let fixture: ComponentFixture<Alert>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Alert, AlertTitle, AlertDescription],
		}).compileComponents();

		fixture = TestBed.createComponent(Alert);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should have role="alert"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('alert');
	});

	it('should default to "default" variant', () => {
		expect(component.variant()).toBe('default');
	});

	it('should have aria-live="polite" for non-destructive variants', () => {
		fixture.componentRef.setInput('variant', 'success');
		fixture.detectChanges();

		expect(fixture.nativeElement.getAttribute('aria-live')).toBe('polite');
	});

	it('should have aria-live="assertive" for destructive variant', () => {
		fixture.componentRef.setInput('variant', 'destructive');
		fixture.detectChanges();

		expect(fixture.nativeElement.getAttribute('aria-live')).toBe('assertive');
	});

	it('should apply variant styles', () => {
		const variants: AlertVariant[] = ['default', 'destructive', 'success', 'warning', 'info'];

		for (const variant of variants) {
			fixture.componentRef.setInput('variant', variant);
			fixture.detectChanges();

			const style = fixture.nativeElement.style;
			expect(style.getPropertyValue('--alert-bg')).toBeTruthy();
			expect(style.getPropertyValue('--alert-border')).toBeTruthy();
			expect(style.getPropertyValue('--alert-color')).toBeTruthy();
		}
	});

	it('should apply custom class', () => {
		fixture.componentRef.setInput('class', 'my-alert');
		fixture.detectChanges();

		expect(fixture.nativeElement.classList.contains('my-alert')).toBe(true);
	});
});

describe('AlertTitle', () => {
	let fixture: ComponentFixture<AlertTitle>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AlertTitle],
		}).compileComponents();

		fixture = TestBed.createComponent(AlertTitle);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});

describe('AlertDescription', () => {
	let fixture: ComponentFixture<AlertDescription>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AlertDescription],
		}).compileComponents();

		fixture = TestBed.createComponent(AlertDescription);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});

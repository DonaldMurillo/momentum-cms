import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Badge } from './badge.component';
import type { BadgeVariant } from './badge.types';

describe('Badge', () => {
	let component: Badge;
	let fixture: ComponentFixture<Badge>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Badge],
		}).compileComponents();

		fixture = TestBed.createComponent(Badge);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should not have a role by default', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBeNull();
	});

	it('should apply role when provided', () => {
		fixture.componentRef.setInput('role', 'status');
		fixture.detectChanges();
		expect(fixture.nativeElement.getAttribute('role')).toBe('status');
	});

	it('should default to "default" variant', () => {
		expect(component.variant()).toBe('default');
	});

	it('should apply variant styles', () => {
		const variants: BadgeVariant[] = [
			'default',
			'secondary',
			'destructive',
			'outline',
			'success',
			'warning',
		];

		for (const variant of variants) {
			fixture.componentRef.setInput('variant', variant);
			fixture.detectChanges();

			// Verify CSS variable is set
			const style = fixture.nativeElement.style;
			expect(style.getPropertyValue('--badge-bg')).toBeTruthy();
			expect(style.getPropertyValue('--badge-color')).toBeTruthy();
		}
	});

	it('should apply custom class', () => {
		fixture.componentRef.setInput('class', 'custom-class');
		fixture.detectChanges();

		expect(fixture.nativeElement.classList.contains('custom-class')).toBe(true);
	});

	it('should have outline border only for outline variant', () => {
		fixture.componentRef.setInput('variant', 'outline');
		fixture.detectChanges();

		const style = fixture.nativeElement.style;
		expect(style.getPropertyValue('--badge-border')).toContain('--mcms-border');
	});

	it('should have transparent border for non-outline variants', () => {
		fixture.componentRef.setInput('variant', 'success');
		fixture.detectChanges();

		const style = fixture.nativeElement.style;
		expect(style.getPropertyValue('--badge-border')).toBe('transparent');
	});
});

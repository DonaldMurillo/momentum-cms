import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlCheckbox } from './checkbox.component';

@Component({
	imports: [HdlCheckbox],
	template: `<hdl-checkbox />`,
})
class TestHost {}

@Component({
	imports: [HdlCheckbox],
	template: `<hdl-checkbox [disabled]="true" />`,
})
class TestHostDisabled {}

@Component({
	imports: [HdlCheckbox],
	template: `<hdl-checkbox [indeterminate]="true" />`,
})
class TestHostIndeterminate {}

describe('HdlCheckbox', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost, TestHostDisabled, TestHostIndeterminate],
		}).compileComponents();
	});

	it('should have role="checkbox"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		expect(el.getAttribute('role')).toBe('checkbox');
	});

	it('should have aria-checked="false" by default', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		expect(el.getAttribute('aria-checked')).toBe('false');
	});

	it('should have tabindex="0"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		expect(el.getAttribute('tabindex')).toBe('0');
	});

	it('should toggle on click', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		el.click();
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('true');
	});

	it('should toggle on Enter key', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('true');
	});

	it('should toggle on Space key', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('true');
	});

	it('should toggle back to false on second click', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		el.click();
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('true');
		el.click();
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('false');
	});

	it('should not toggle when disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		expect(el.getAttribute('aria-checked')).toBe('false');
		el.click();
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('false');
	});

	it('should have aria-disabled when disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		expect(el.getAttribute('aria-disabled')).toBe('true');
	});

	it('should have tabindex="-1" when disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		expect(el.getAttribute('tabindex')).toBe('-1');
	});

	it('should show aria-checked="mixed" when indeterminate', () => {
		const fixture = TestBed.createComponent(TestHostIndeterminate);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		expect(el.getAttribute('aria-checked')).toBe('mixed');
	});

	it('should not toggle on Enter when disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-checkbox');
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('false');
	});
});

import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlSwitch } from './switch.component';

@Component({
	imports: [HdlSwitch],
	template: `<hdl-switch />`,
})
class TestHost {}

@Component({
	imports: [HdlSwitch],
	template: `<hdl-switch [disabled]="true" />`,
})
class TestHostDisabled {}

describe('HdlSwitch', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost, TestHostDisabled],
		}).compileComponents();
	});

	it('should have role="switch"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		expect(el.getAttribute('role')).toBe('switch');
	});

	it('should expose styling contract attributes on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		expect(el.getAttribute('data-slot')).toBe('switch');
		expect(el.getAttribute('data-state')).toBe('unchecked');
		expect(el.getAttribute('data-disabled')).toBeNull();
	});

	it('should have aria-checked="false" by default', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		expect(el.getAttribute('aria-checked')).toBe('false');
	});

	it('should have tabindex="0"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		expect(el.getAttribute('tabindex')).toBe('0');
	});

	it('should toggle on click', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		el.click();
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('true');
		expect(el.getAttribute('data-state')).toBe('checked');
	});

	it('should toggle on Enter key', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('true');
	});

	it('should toggle on Space key', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('true');
	});

	it('should toggle back to false on second click', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
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
		const el = fixture.nativeElement.querySelector('hdl-switch');
		expect(el.getAttribute('aria-checked')).toBe('false');
		el.click();
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('false');
	});

	it('should have aria-disabled when disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		expect(el.getAttribute('aria-disabled')).toBe('true');
		expect(el.getAttribute('data-disabled')).toBe('true');
	});

	it('should have tabindex="-1" when disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		expect(el.getAttribute('tabindex')).toBe('-1');
	});

	it('should not toggle on Enter when disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-switch');
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();
		expect(el.getAttribute('aria-checked')).toBe('false');
	});
});

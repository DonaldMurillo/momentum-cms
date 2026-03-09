import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlCombobox } from './combobox.component';
import { HdlComboboxInput } from './combobox-input.component';

@Component({
	imports: [HdlCombobox, HdlComboboxInput],
	template: `
		<hdl-combobox>
			<input hdl-combobox-input />
		</hdl-combobox>
	`,
})
class TestHost {}

@Component({
	imports: [HdlCombobox, HdlComboboxInput],
	template: `
		<hdl-combobox [disabled]="true">
			<input hdl-combobox-input />
		</hdl-combobox>
	`,
})
class TestHostDisabled {}

describe('HdlCombobox', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost, TestHostDisabled],
		}).compileComponents();
	});

	it('should render the combobox host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-combobox');
		expect(el).toBeTruthy();
	});

	it('should render the combobox input', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const input = fixture.nativeElement.querySelector('input[hdl-combobox-input]');
		expect(input).toBeTruthy();
	});

	it('should have role="combobox" on the input', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('role')).toBe('combobox');
	});

	it('should start in closed state', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const host = fixture.nativeElement.querySelector('hdl-combobox');
		expect(host.getAttribute('data-state')).toBe('closed');
	});

	it('should expose disabled state via data attribute', async () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const host = fixture.nativeElement.querySelector('hdl-combobox');
		expect(host.getAttribute('data-disabled')).toBe('true');
	});

	it('should expose Combobox directive via inject()', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const comboboxDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-COMBOBOX',
		);
		const comp = comboboxDebug.componentInstance as HdlCombobox;
		expect(comp.ariaDirective).toBeTruthy();
		expect(comp.disabled()).toBe(false);
	});

	it('should expose styling contract attributes on the combobox and input', async () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const host = fixture.nativeElement.querySelector('hdl-combobox');
		const input = fixture.nativeElement.querySelector('input');

		expect(host.getAttribute('data-slot')).toBe('combobox');
		expect(host.getAttribute('data-state')).toBe('closed');
		expect(host.getAttribute('data-disabled')).toBe('true');
		expect(input.getAttribute('data-slot')).toBe('combobox-input');
	});

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-combobox');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});

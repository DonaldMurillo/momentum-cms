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

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-combobox');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});

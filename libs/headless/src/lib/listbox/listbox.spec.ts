import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlListbox } from './listbox.component';
import { HdlOption } from './option.component';

@Component({
	imports: [HdlListbox, HdlOption],
	template: `
		<hdl-listbox>
			<hdl-option value="opt1" label="Option 1">Option 1</hdl-option>
			<hdl-option value="opt2" label="Option 2">Option 2</hdl-option>
			<hdl-option value="opt3" label="Option 3" [disabled]="true">Option 3</hdl-option>
		</hdl-listbox>
	`,
})
class TestHost {}

describe('HdlListbox', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();
	});

	it('should render options', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const options = fixture.nativeElement.querySelectorAll('hdl-option');
		expect(options.length).toBe(3);
	});

	it('should render option text content', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const options = fixture.nativeElement.querySelectorAll('hdl-option');
		expect(options[0].textContent).toContain('Option 1');
		expect(options[1].textContent).toContain('Option 2');
	});

	it('should expose Listbox directive via inject()', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const listboxDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-LISTBOX',
		);
		const listboxComp = listboxDebug.componentInstance as HdlListbox;
		expect(listboxComp.listbox).toBeTruthy();
		expect(listboxComp.orientation()).toBe('vertical');
	});

	it('should expose Option directive via inject()', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const optionDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-OPTION',
		);
		const optionComp = optionDebug.componentInstance as HdlOption;
		expect(optionComp.option).toBeTruthy();
		expect(optionComp.value()).toBe('opt1');
	});

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-listbox');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});

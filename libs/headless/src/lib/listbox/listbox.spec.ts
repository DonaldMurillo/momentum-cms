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

	it('should reflect selection state when values change via the listbox API', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const listboxDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-LISTBOX',
		);
		const listboxComp = listboxDebug.componentInstance as HdlListbox;
		const options: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('hdl-option'));

		listboxComp.ariaDirective.values.set(['opt1']);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(options[0].getAttribute('data-state')).toBe('selected');
		expect(options[1].getAttribute('data-state')).toBe('unselected');
	});

	it('should update selection state when values change to a different option', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const listboxDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-LISTBOX',
		);
		const listboxComp = listboxDebug.componentInstance as HdlListbox;
		const options: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('hdl-option'));

		listboxComp.ariaDirective.values.set(['opt1']);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(options[0].getAttribute('data-state')).toBe('selected');

		listboxComp.ariaDirective.values.set(['opt2']);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(options[1].getAttribute('data-state')).toBe('selected');
		expect(options[0].getAttribute('data-state')).toBe('unselected');
	});

	it('should mark disabled options with data-disabled', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const options = fixture.nativeElement.querySelectorAll('hdl-option');
		expect(options[2].getAttribute('data-disabled')).toBe('true');
	});

	it('should expose Listbox directive via inject()', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const listboxDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-LISTBOX',
		);
		const listboxComp = listboxDebug.componentInstance as HdlListbox;
		expect(listboxComp.ariaDirective).toBeTruthy();
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

	it('should expose styling contract attributes on the listbox and options', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const listbox = fixture.nativeElement.querySelector('hdl-listbox');
		const options = fixture.nativeElement.querySelectorAll('hdl-option');

		expect(listbox.getAttribute('data-slot')).toBe('listbox');
		expect(listbox.getAttribute('data-orientation')).toBe('vertical');
		expect(options[0].getAttribute('data-slot')).toBe('option');
		expect(options[0].getAttribute('data-state')).toBe('unselected');
		expect(options[2].getAttribute('data-disabled')).toBe('true');
	});

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-listbox');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});

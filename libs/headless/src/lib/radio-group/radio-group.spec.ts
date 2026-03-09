import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlRadioGroup } from './radio-group.component';
import { HdlRadioItem } from './radio-item.component';

@Component({
	imports: [HdlRadioGroup, HdlRadioItem],
	template: `
		<hdl-radio-group>
			<hdl-radio-item value="a">Option A</hdl-radio-item>
			<hdl-radio-item value="b">Option B</hdl-radio-item>
			<hdl-radio-item value="c">Option C</hdl-radio-item>
		</hdl-radio-group>
	`,
})
class TestHost {}

@Component({
	imports: [HdlRadioGroup, HdlRadioItem],
	template: `
		<hdl-radio-group [disabled]="true">
			<hdl-radio-item value="a">Option A</hdl-radio-item>
			<hdl-radio-item value="b">Option B</hdl-radio-item>
		</hdl-radio-group>
	`,
})
class TestHostDisabled {}

@Component({
	imports: [HdlRadioGroup, HdlRadioItem],
	template: `
		<hdl-radio-group>
			<hdl-radio-item value="a">Option A</hdl-radio-item>
			<hdl-radio-item value="b" [disabled]="true">Option B</hdl-radio-item>
			<hdl-radio-item value="c">Option C</hdl-radio-item>
		</hdl-radio-group>
	`,
})
class TestHostDisabledItem {}

@Component({
	imports: [HdlRadioGroup, HdlRadioItem],
	template: `
		<hdl-radio-group>
			<hdl-radio-item value="a" [disabled]="true">Option A</hdl-radio-item>
			<hdl-radio-item value="b">Option B</hdl-radio-item>
			<hdl-radio-item value="c">Option C</hdl-radio-item>
		</hdl-radio-group>
	`,
})
class TestHostLeadingDisabled {}

describe('HdlRadioGroup', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost, TestHostDisabled, TestHostDisabledItem, TestHostLeadingDisabled],
		}).compileComponents();
	});

	it('should have role="radiogroup"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-radio-group');
		expect(el.getAttribute('role')).toBe('radiogroup');
	});

	it('should render radio items with role="radio"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('[role="radio"]');
		expect(items.length).toBe(3);
	});

	it('should have all items aria-checked="false" initially', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		for (const item of items) {
			expect(item.getAttribute('aria-checked')).toBe('false');
		}
	});

	it('should make the first enabled item tabbable before selection', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');

		expect(items[0].getAttribute('tabindex')).toBe('0');
		expect(items[1].getAttribute('tabindex')).toBe('-1');
		expect(items[2].getAttribute('tabindex')).toBe('-1');
	});

	it('should select item on click', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		items[1].click();
		fixture.detectChanges();
		expect(items[1].getAttribute('aria-checked')).toBe('true');
		expect(items[0].getAttribute('aria-checked')).toBe('false');
		expect(items[2].getAttribute('aria-checked')).toBe('false');
	});

	it('should update tabindex on selection (roving tabindex)', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		items[0].click();
		fixture.detectChanges();
		expect(items[0].getAttribute('tabindex')).toBe('0');
		expect(items[1].getAttribute('tabindex')).toBe('-1');
		expect(items[2].getAttribute('tabindex')).toBe('-1');
	});

	it('should navigate forward with ArrowDown', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const group = fixture.nativeElement.querySelector('hdl-radio-group');
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		items[0].click();
		fixture.detectChanges();
		expect(items[0].getAttribute('aria-checked')).toBe('true');

		group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
		fixture.detectChanges();
		expect(items[1].getAttribute('aria-checked')).toBe('true');
		expect(items[0].getAttribute('aria-checked')).toBe('false');
	});

	it('should navigate backward with ArrowUp', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const group = fixture.nativeElement.querySelector('hdl-radio-group');
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		items[1].click();
		fixture.detectChanges();

		group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
		fixture.detectChanges();
		expect(items[0].getAttribute('aria-checked')).toBe('true');
		expect(items[1].getAttribute('aria-checked')).toBe('false');
	});

	it('should wrap from last to first with ArrowDown', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const group = fixture.nativeElement.querySelector('hdl-radio-group');
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		items[2].click();
		fixture.detectChanges();

		group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
		fixture.detectChanges();
		expect(items[0].getAttribute('aria-checked')).toBe('true');
		expect(items[2].getAttribute('aria-checked')).toBe('false');
	});

	it('should wrap from first to last with ArrowUp', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const group = fixture.nativeElement.querySelector('hdl-radio-group');
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		items[0].click();
		fixture.detectChanges();

		group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
		fixture.detectChanges();
		expect(items[2].getAttribute('aria-checked')).toBe('true');
		expect(items[0].getAttribute('aria-checked')).toBe('false');
	});

	it('should not select when group is disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		items[0].click();
		fixture.detectChanges();
		expect(items[0].getAttribute('aria-checked')).toBe('false');
	});

	it('should have aria-disabled on disabled group', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-radio-group');
		expect(el.getAttribute('aria-disabled')).toBe('true');
	});

	it('should not select a disabled individual item', () => {
		const fixture = TestBed.createComponent(TestHostDisabledItem);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		items[1].click();
		fixture.detectChanges();
		expect(items[1].getAttribute('aria-checked')).toBe('false');
	});

	it('should have aria-disabled on disabled item', () => {
		const fixture = TestBed.createComponent(TestHostDisabledItem);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');
		expect(items[1].getAttribute('aria-disabled')).toBe('true');
		expect(items[0].getAttribute('aria-disabled')).toBeNull();
	});

	it('should skip disabled items when choosing the initial tab stop', () => {
		const fixture = TestBed.createComponent(TestHostLeadingDisabled);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');

		expect(items[0].getAttribute('tabindex')).toBe('-1');
		expect(items[1].getAttribute('tabindex')).toBe('0');
		expect(items[2].getAttribute('tabindex')).toBe('-1');
	});

	it('should keep at least one item tabbable when value does not match any item', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		// Set value to something that doesn't match any radio item
		const group = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-RADIO-GROUP',
		);
		const groupComponent = group.componentInstance as HdlRadioGroup;
		groupComponent.value.set('nonexistent');
		fixture.detectChanges();

		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');

		// No item should claim selection for a non-matching value
		for (const item of items) {
			expect(item.getAttribute('aria-checked')).toBe('false');
		}

		// First enabled item must be tabbable so keyboard users can reach the group
		expect(items[0].getAttribute('tabindex')).toBe('0');
		expect(items[1].getAttribute('tabindex')).toBe('-1');
		expect(items[2].getAttribute('tabindex')).toBe('-1');
	});

	it('should not move focus with arrow keys when the group is disabled', () => {
		const fixture = TestBed.createComponent(TestHostDisabled);
		fixture.detectChanges();
		const group = fixture.nativeElement.querySelector('hdl-radio-group');
		const items = fixture.nativeElement.querySelectorAll('hdl-radio-item');

		items[0].focus();
		expect(document.activeElement).toBe(items[0]);

		group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
		fixture.detectChanges();

		expect(document.activeElement).toBe(items[0]);
	});
});

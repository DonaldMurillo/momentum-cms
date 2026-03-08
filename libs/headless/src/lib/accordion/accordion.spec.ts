import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlAccordion } from './accordion.component';
import { HdlAccordionItem } from './accordion-item.component';
import { HdlAccordionTrigger } from './accordion-trigger.component';
import { HdlAccordionContent } from './accordion-content.component';

@Component({
	imports: [HdlAccordion, HdlAccordionItem, HdlAccordionTrigger, HdlAccordionContent],
	template: `
		<hdl-accordion>
			<hdl-accordion-item>
				<hdl-accordion-trigger panelId="p1">Section 1</hdl-accordion-trigger>
				<hdl-accordion-content panelId="p1">
					<p>Content 1</p>
				</hdl-accordion-content>
			</hdl-accordion-item>
			<hdl-accordion-item>
				<hdl-accordion-trigger panelId="p2">Section 2</hdl-accordion-trigger>
				<hdl-accordion-content panelId="p2">
					<p>Content 2</p>
				</hdl-accordion-content>
			</hdl-accordion-item>
		</hdl-accordion>
	`,
})
class TestHost {}

describe('HdlAccordion', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();
	});

	it('should render accordion items', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-accordion-item');
		expect(items.length).toBe(2);
	});

	it('should render triggers with correct text', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const triggers = fixture.nativeElement.querySelectorAll('hdl-accordion-trigger');
		expect(triggers[0].textContent).toContain('Section 1');
		expect(triggers[1].textContent).toContain('Section 2');
	});

	it('should have content panels initially hidden', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const contents = fixture.nativeElement.querySelectorAll('hdl-accordion-content');
		expect(contents[0].hidden).toBe(true);
		expect(contents[1].hidden).toBe(true);
	});

	it('should expose styling contract attributes on the accordion hosts', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const accordion = fixture.nativeElement.querySelector('hdl-accordion');
		const trigger = fixture.nativeElement.querySelector('hdl-accordion-trigger');
		const content = fixture.nativeElement.querySelector('hdl-accordion-content');

		expect(accordion.getAttribute('data-slot')).toBe('accordion');
		expect(trigger.getAttribute('data-slot')).toBe('accordion-trigger');
		expect(trigger.getAttribute('data-state')).toBe('closed');
		expect(content.getAttribute('data-slot')).toBe('accordion-content');
		expect(content.getAttribute('data-state')).toBe('closed');
	});

	it('should expose AccordionTrigger directive via inject()', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const triggerDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-ACCORDION-TRIGGER',
		);
		const triggerComp = triggerDebug.componentInstance as HdlAccordionTrigger;
		expect(triggerComp.trigger).toBeTruthy();
		expect(triggerComp.panelId()).toBe('p1');
	});

	it('should have no styles on the host element', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-accordion');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});

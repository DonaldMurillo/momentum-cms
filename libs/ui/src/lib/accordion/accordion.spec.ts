import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Accordion } from './accordion.component';
import { AccordionItem } from './accordion-item.component';
import { AccordionTrigger } from './accordion-trigger.component';
import { AccordionContent } from './accordion-content.component';

@Component({
	imports: [Accordion, AccordionItem, AccordionTrigger, AccordionContent],
	template: `
		<mcms-accordion>
			<mcms-accordion-item>
				<mcms-accordion-trigger panelId="item1">Section 1</mcms-accordion-trigger>
				<mcms-accordion-content panelId="item1">Content 1</mcms-accordion-content>
			</mcms-accordion-item>
			<mcms-accordion-item>
				<mcms-accordion-trigger panelId="item2">Section 2</mcms-accordion-trigger>
				<mcms-accordion-content panelId="item2">Content 2</mcms-accordion-content>
			</mcms-accordion-item>
			<mcms-accordion-item>
				<mcms-accordion-trigger panelId="item3" [disabled]="true">Section 3</mcms-accordion-trigger>
				<mcms-accordion-content panelId="item3">Content 3</mcms-accordion-content>
			</mcms-accordion-item>
		</mcms-accordion>
	`,
})
class _TestHostComponent {}

@Component({
	imports: [Accordion, AccordionItem, AccordionTrigger, AccordionContent],
	template: `
		<mcms-accordion [multiExpandable]="true">
			<mcms-accordion-item>
				<mcms-accordion-trigger panelId="multi1">Section 1</mcms-accordion-trigger>
				<mcms-accordion-content panelId="multi1">Content 1</mcms-accordion-content>
			</mcms-accordion-item>
			<mcms-accordion-item>
				<mcms-accordion-trigger panelId="multi2">Section 2</mcms-accordion-trigger>
				<mcms-accordion-content panelId="multi2">Content 2</mcms-accordion-content>
			</mcms-accordion-item>
		</mcms-accordion>
	`,
})
class _TestMultiExpandableComponent {}

describe('Accordion', () => {
	let fixture: ComponentFixture<Accordion>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Accordion],
		}).compileComponents();

		fixture = TestBed.createComponent(Accordion);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should be a block element', () => {
		expect(fixture.nativeElement.classList.contains('block')).toBe(true);
	});
});

describe('AccordionItem', () => {
	let fixture: ComponentFixture<AccordionItem>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AccordionItem],
		}).compileComponents();

		fixture = TestBed.createComponent(AccordionItem);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have border-bottom', () => {
		expect(fixture.nativeElement.classList.contains('border-b')).toBe(true);
	});
});

describe('Accordion Integration', () => {
	describe('single expandable mode', () => {
		let fixture: ComponentFixture<_TestHostComponent>;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [_TestHostComponent],
			}).compileComponents();

			fixture = TestBed.createComponent(_TestHostComponent);
			fixture.detectChanges();
			await fixture.whenStable();
		});

		it('should render all accordion items', () => {
			const items = fixture.nativeElement.querySelectorAll('mcms-accordion-item');
			expect(items.length).toBe(3);
		});

		it('should render all triggers', () => {
			const triggers = fixture.nativeElement.querySelectorAll('mcms-accordion-trigger');
			expect(triggers.length).toBe(3);
		});

		it('should render all content panels', () => {
			const panels = fixture.nativeElement.querySelectorAll('mcms-accordion-content');
			expect(panels.length).toBe(3);
		});

		it('should have all content hidden by default', () => {
			const panels = fixture.nativeElement.querySelectorAll('mcms-accordion-content');
			panels.forEach((panel: HTMLElement) => {
				expect(panel.hidden).toBe(true);
			});
		});

		it('should have triggers with aria-expanded="false" by default', () => {
			const triggers = fixture.nativeElement.querySelectorAll('mcms-accordion-trigger');
			triggers.forEach((trigger: HTMLElement) => {
				expect(trigger.getAttribute('aria-expanded')).toBe('false');
			});
		});

		it('should indicate disabled state on trigger', () => {
			const disabledTrigger = fixture.nativeElement.querySelector(
				'mcms-accordion-trigger[panelId="item3"]',
			);
			expect(disabledTrigger.getAttribute('aria-disabled')).toBe('true');
		});

		it('should have chevron icon in triggers', () => {
			const trigger = fixture.nativeElement.querySelector('mcms-accordion-trigger');
			const svg = trigger.querySelector('svg');
			expect(svg).toBeTruthy();
		});
	});

	describe('multi expandable mode', () => {
		let fixture: ComponentFixture<_TestMultiExpandableComponent>;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [_TestMultiExpandableComponent],
			}).compileComponents();

			fixture = TestBed.createComponent(_TestMultiExpandableComponent);
			fixture.detectChanges();
			await fixture.whenStable();
		});

		it('should render all items', () => {
			const items = fixture.nativeElement.querySelectorAll('mcms-accordion-item');
			expect(items.length).toBe(2);
		});

		it('should have all content hidden by default', () => {
			const panels = fixture.nativeElement.querySelectorAll('mcms-accordion-content');
			panels.forEach((panel: HTMLElement) => {
				expect(panel.hidden).toBe(true);
			});
		});
	});
});

describe('AccordionTrigger', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should have flex layout', () => {
		const trigger = fixture.nativeElement.querySelector('mcms-accordion-trigger');
		expect(trigger.classList.contains('flex')).toBe(true);
	});

	it('should have justify-between', () => {
		const trigger = fixture.nativeElement.querySelector('mcms-accordion-trigger');
		expect(trigger.classList.contains('justify-between')).toBe(true);
	});

	it('should have aria-controls pointing to panel', () => {
		const trigger = fixture.nativeElement.querySelector('mcms-accordion-trigger');
		const ariaControls = trigger.getAttribute('aria-controls');
		expect(ariaControls).toBeTruthy();
	});
});

describe('AccordionContent', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should have overflow-hidden', () => {
		const content = fixture.nativeElement.querySelector('mcms-accordion-content');
		expect(content.classList.contains('overflow-hidden')).toBe(true);
	});

	it('should have role="region"', () => {
		const content = fixture.nativeElement.querySelector('mcms-accordion-content');
		expect(content.getAttribute('role')).toBe('region');
	});
});

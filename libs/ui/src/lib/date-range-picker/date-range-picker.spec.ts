import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { DateRangePicker } from './date-range-picker.component';
import type { DateRangeValue } from './date-range-picker.types';

@Component({
	selector: 'mcms-test-host',
	imports: [DateRangePicker],
	template: `
		<mcms-date-range-picker
			[placeholder]="placeholder()"
			[disabled]="disabled()"
			(rangeSelected)="onRange($event)"
			(opened)="openCount.set(openCount() + 1)"
			(closed)="closeCount.set(closeCount() + 1)"
		/>
	`,
})
class TestHost {
	readonly placeholder = signal('Pick a range');
	readonly disabled = signal(false);
	readonly selectedRange = signal<DateRangeValue | null>(null);
	readonly openCount = signal(0);
	readonly closeCount = signal(0);

	onRange(range: DateRangeValue): void {
		this.selectedRange.set(range);
	}
}

describe('DateRangePicker', () => {
	let fixture: ComponentFixture<TestHost>;
	let host: TestHost;
	let overlayContainer: OverlayContainer;
	let overlayContainerElement: HTMLElement;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHost);
		host = fixture.componentInstance;
		overlayContainer = TestBed.inject(OverlayContainer);
		overlayContainerElement = overlayContainer.getContainerElement();
		fixture.detectChanges();
	});

	afterEach(() => {
		overlayContainer.ngOnDestroy();
	});

	function getTriggerButton(): HTMLButtonElement {
		return fixture.nativeElement.querySelector('[data-slot="trigger"]') as HTMLButtonElement;
	}

	function getCalendarDialog(): HTMLElement | null {
		return overlayContainerElement.querySelector('[role="dialog"]');
	}

	function clickTrigger(): void {
		getTriggerButton().click();
		fixture.detectChanges();
	}

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should display placeholder text', () => {
		const label = fixture.nativeElement.querySelector('[data-slot="label"]');
		expect(label.textContent.trim()).toBe('Pick a range');
	});

	it('should open calendar popover on trigger click', () => {
		expect(getCalendarDialog()).toBeNull();
		clickTrigger();
		expect(getCalendarDialog()).toBeTruthy();
	});

	it('should have aria-expanded on trigger', () => {
		const trigger = getTriggerButton();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		clickTrigger();
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
	});

	it('should have aria-haspopup on trigger', () => {
		expect(getTriggerButton().getAttribute('aria-haspopup')).toBe('dialog');
	});

	it('should close on Escape key', () => {
		clickTrigger();
		expect(getCalendarDialog()).toBeTruthy();

		const dialog = getCalendarDialog();
		expect(dialog).toBeTruthy();
		dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		fixture.detectChanges();

		expect(getCalendarDialog()).toBeNull();
	});

	it('should close on backdrop click', () => {
		clickTrigger();
		expect(getCalendarDialog()).toBeTruthy();

		const backdrop = overlayContainerElement.querySelector('.cdk-overlay-backdrop') as HTMLElement;
		backdrop.click();
		fixture.detectChanges();

		expect(getCalendarDialog()).toBeNull();
	});

	it('should emit opened/closed events', () => {
		clickTrigger();
		expect(host.openCount()).toBe(1);

		const backdrop = overlayContainerElement.querySelector('.cdk-overlay-backdrop') as HTMLElement;
		backdrop.click();
		fixture.detectChanges();

		expect(host.closeCount()).toBe(1);
	});

	it('should render calendar in range mode', () => {
		clickTrigger();
		const calendar = overlayContainerElement.querySelector('hdl-calendar');
		expect(calendar).toBeTruthy();
		const grid = overlayContainerElement.querySelector('[role="grid"]');
		expect(grid).toBeTruthy();
	});

	it('should not open when disabled', () => {
		host.disabled.set(true);
		fixture.detectChanges();

		clickTrigger();
		expect(getCalendarDialog()).toBeNull();
	});

	it('should display selected range as formatted text', () => {
		const picker = fixture.debugElement.children[0].componentInstance as DateRangePicker;
		// Simulate a range selection via the internal API
		picker.onRangeSelected({
			start: new Date(2025, 0, 10),
			end: new Date(2025, 0, 20),
		});
		fixture.detectChanges();

		const label = fixture.nativeElement.querySelector('[data-slot="label"]');
		expect(label.textContent.trim()).toContain('Jan');
		expect(label.textContent.trim()).toContain('10');
		expect(label.textContent.trim()).toContain('20');
	});

	it('should emit rangeSelected when range is completed', () => {
		const picker = fixture.debugElement.children[0].componentInstance as DateRangePicker;
		picker.onRangeSelected({
			start: new Date(2025, 0, 10),
			end: new Date(2025, 0, 20),
		});

		const range = host.selectedRange();
		expect(range).toBeTruthy();
		expect(range?.start?.getDate()).toBe(10);
		expect(range?.end?.getDate()).toBe(20);
	});

	it('should close after range selection', () => {
		clickTrigger();
		expect(getCalendarDialog()).toBeTruthy();

		const picker = fixture.debugElement.children[0].componentInstance as DateRangePicker;
		picker.onRangeSelected({
			start: new Date(2025, 0, 10),
			end: new Date(2025, 0, 20),
		});
		fixture.detectChanges();

		expect(getCalendarDialog()).toBeNull();
	});

	it('should accept class input for host customization per UI CLAUDE.md', () => {
		// UI components must accept a class input and merge with host classes
		const picker = fixture.debugElement.children[0].componentInstance as DateRangePicker;
		// The component should have a class input
		expect('class' in picker).toBe(true);
	});

	it('should have calendar icon in trigger using ng-icon', () => {
		const icon = getTriggerButton().querySelector('ng-icon');
		expect(icon).toBeTruthy();
	});

	it('should have dialog role on popover', () => {
		clickTrigger();
		const dialog = getCalendarDialog();
		expect(dialog?.getAttribute('role')).toBe('dialog');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
	});
});

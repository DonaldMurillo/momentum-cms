import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HdlCalendar } from './calendar.component';

describe('HdlCalendar', () => {
	let fixture: ComponentFixture<HdlCalendar>;
	let component: HdlCalendar;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [HdlCalendar],
		}).compileComponents();

		fixture = TestBed.createComponent(HdlCalendar);
		component = fixture.componentInstance;
		// Set to a known month for deterministic tests
		component.viewMonth.set(0); // January
		component.viewYear.set(2025);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should render month grid with correct days', () => {
		const weeks = component.weeks();
		// January 2025 starts on Wednesday (3 empty cells before)
		expect(weeks.length).toBeGreaterThanOrEqual(4);
		// First non-null day should be 1
		const firstDay = weeks[0].find((d) => d !== null);
		expect(firstDay?.getDate()).toBe(1);
		// Last day should be 31
		const allDays = weeks.flat().filter((d): d is Date => d !== null);
		expect(allDays[allDays.length - 1].getDate()).toBe(31);
	});

	it('should have role="grid" on table', () => {
		const table = fixture.nativeElement.querySelector('table');
		expect(table.getAttribute('role')).toBe('grid');
	});

	it('should render weekday headers', () => {
		const headers = fixture.nativeElement.querySelectorAll('th');
		expect(headers.length).toBe(7);
		expect(headers[0].textContent.trim()).toBe('Su');
		expect(headers[6].textContent.trim()).toBe('Sa');
	});

	it('should display correct month label', () => {
		const label = fixture.nativeElement.querySelector('[data-slot="month-label"]');
		expect(label.textContent.trim()).toBe('January 2025');
	});

	it('should navigate to previous month', () => {
		component.prevMonth();
		fixture.detectChanges();
		expect(component.viewMonth()).toBe(11);
		expect(component.viewYear()).toBe(2024);
	});

	it('should navigate to next month', () => {
		component.nextMonth();
		fixture.detectChanges();
		expect(component.viewMonth()).toBe(1);
		expect(component.viewYear()).toBe(2025);
	});

	it('should select a day in single mode', () => {
		const emitted: Date[] = [];
		component.dateSelected.subscribe((d: Date) => emitted.push(d));
		const day = new Date(2025, 0, 15);
		component.selectDay(day);

		expect(component.selected()).toEqual(day);
		expect(emitted.length).toBe(1);
		expect(emitted[0].getDate()).toBe(15);
	});

	it('should mark selected day with aria-selected', () => {
		component.selectDay(new Date(2025, 0, 15));
		fixture.detectChanges();

		const selectedCell = fixture.nativeElement.querySelector('[aria-selected="true"]');
		expect(selectedCell).toBeTruthy();
		expect(selectedCell.textContent.trim()).toBe('15');
	});

	it('should handle range selection (two clicks)', () => {
		fixture.componentRef.setInput('mode', 'range');
		fixture.detectChanges();

		const emitted: unknown[] = [];
		component.rangeSelected.subscribe((r: unknown) => emitted.push(r));

		component.selectDay(new Date(2025, 0, 10));
		expect(component.range().start?.getDate()).toBe(10);
		expect(component.range().end).toBeNull();

		component.selectDay(new Date(2025, 0, 20));
		expect(component.range().start?.getDate()).toBe(10);
		expect(component.range().end?.getDate()).toBe(20);
		expect(emitted.length).toBe(1);
	});

	it('should swap range if end < start', () => {
		fixture.componentRef.setInput('mode', 'range');
		fixture.detectChanges();

		component.selectDay(new Date(2025, 0, 20));
		component.selectDay(new Date(2025, 0, 5));

		expect(component.range().start?.getDate()).toBe(5);
		expect(component.range().end?.getDate()).toBe(20);
	});

	describe('keyboard navigation', () => {
		it('should move focus with arrow keys', () => {
			component.setFocusedDate(new Date(2025, 0, 15));
			fixture.detectChanges();

			component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
			expect(component.isFocused(new Date(2025, 0, 16))).toBe(true);

			component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
			expect(component.isFocused(new Date(2025, 0, 23))).toBe(true);

			component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
			expect(component.isFocused(new Date(2025, 0, 22))).toBe(true);

			component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
			expect(component.isFocused(new Date(2025, 0, 15))).toBe(true);
		});

		it('should navigate across month boundary', () => {
			component.setFocusedDate(new Date(2025, 0, 31));
			component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

			expect(component.viewMonth()).toBe(1); // February
			expect(component.isFocused(new Date(2025, 1, 1))).toBe(true);
		});

		it('should select day on Enter', () => {
			component.setFocusedDate(new Date(2025, 0, 15));
			const event = new KeyboardEvent('keydown', { key: 'Enter' });
			const spy = vi.spyOn(event, 'preventDefault');
			component.onKeydown(event);

			expect(component.selected()?.getDate()).toBe(15);
			expect(spy).toHaveBeenCalled();
		});
	});

	it('should identify today', () => {
		const today = new Date();
		component.viewMonth.set(today.getMonth());
		component.viewYear.set(today.getFullYear());
		fixture.detectChanges();

		expect(component.isToday(today)).toBe(true);
		expect(component.isToday(new Date(2000, 0, 1))).toBe(false);
	});
});

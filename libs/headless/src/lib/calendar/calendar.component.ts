import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	model,
	output,
	signal,
} from '@angular/core';

export interface DateRange {
	start: Date | null;
	end: Date | null;
}

/**
 * Headless calendar component — behavior only, no styles, no DOM.
 * Exposes state signals and methods for consumers to build their own calendar UI.
 */
@Component({
	selector: 'hdl-calendar',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		role: 'application',
		'[attr.aria-label]': 'ariaLabel()',
		'(keydown)': 'onKeydown($event)',
	},
	template: '<ng-content />',
})
export class HdlCalendar {
	readonly ariaLabel = input('Calendar');
	readonly mode = input<'single' | 'range'>('single');
	readonly selected = model<Date | null>(null);
	readonly range = model<DateRange>({ start: null, end: null });
	readonly dateSelected = output<Date>();
	readonly rangeSelected = output<DateRange>();

	readonly viewMonth = signal(new Date().getMonth());
	readonly viewYear = signal(new Date().getFullYear());
	private readonly focusedDate = signal<Date | null>(null);
	private rangeSelecting = false;

	readonly weekDays = [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
	];

	readonly monthLabel = computed(() => {
		const date = new Date(this.viewYear(), this.viewMonth());
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	});

	readonly weeks = computed(() => {
		const year = this.viewYear();
		const month = this.viewMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const weeks: (Date | null)[][] = [];
		let currentWeek: (Date | null)[] = [];

		// Pad start
		for (let i = 0; i < firstDay.getDay(); i++) {
			currentWeek.push(null);
		}

		for (let d = 1; d <= lastDay.getDate(); d++) {
			currentWeek.push(new Date(year, month, d));
			if (currentWeek.length === 7) {
				weeks.push(currentWeek);
				currentWeek = [];
			}
		}

		// Pad end
		if (currentWeek.length > 0) {
			while (currentWeek.length < 7) {
				currentWeek.push(null);
			}
			weeks.push(currentWeek);
		}

		return weeks;
	});

	prevMonth(): void {
		const m = this.viewMonth();
		if (m === 0) {
			this.viewMonth.set(11);
			this.viewYear.update((y) => y - 1);
		} else {
			this.viewMonth.set(m - 1);
		}
	}

	nextMonth(): void {
		const m = this.viewMonth();
		if (m === 11) {
			this.viewMonth.set(0);
			this.viewYear.update((y) => y + 1);
		} else {
			this.viewMonth.set(m + 1);
		}
	}

	selectDay(date: Date): void {
		if (this.mode() === 'single') {
			this.selected.set(date);
			this.dateSelected.emit(date);
			return;
		}

		// Range mode
		const current = this.range();
		if (!this.rangeSelecting || !current.start) {
			this.range.set({ start: date, end: null });
			this.rangeSelecting = true;
		} else {
			const start = current.start;
			const newRange: DateRange = date < start ? { start: date, end: start } : { start, end: date };
			this.range.set(newRange);
			this.rangeSelected.emit(newRange);
			this.rangeSelecting = false;
		}
	}

	setFocusedDate(date: Date): void {
		this.focusedDate.set(date);
	}

	isSelected(day: Date | null): boolean {
		if (!day) return false;
		if (this.mode() === 'single') {
			const sel = this.selected();
			return !!sel && sameDay(sel, day);
		}
		const r = this.range();
		return (!!r.start && sameDay(r.start, day)) || (!!r.end && sameDay(r.end, day));
	}

	isToday(day: Date | null): boolean {
		if (!day) return false;
		return sameDay(day, new Date());
	}

	isInRange(day: Date | null): boolean {
		if (!day || this.mode() !== 'range') return false;
		const r = this.range();
		if (!r.start || !r.end) return false;
		return day > r.start && day < r.end;
	}

	isRangeStart(day: Date | null): boolean {
		if (!day) return false;
		const r = this.range();
		return !!r.start && sameDay(r.start, day);
	}

	isRangeEnd(day: Date | null): boolean {
		if (!day) return false;
		const r = this.range();
		return !!r.end && sameDay(r.end, day);
	}

	isFocused(day: Date | null): boolean {
		if (!day) return false;
		const focused = this.focusedDate();
		if (!focused) {
			// Default focus to first day of month or selected/range-start
			const sel = this.mode() === 'single' ? this.selected() : this.range().start;
			if (sel && sel.getMonth() === this.viewMonth() && sel.getFullYear() === this.viewYear()) {
				return sameDay(sel, day);
			}
			return day.getDate() === 1;
		}
		return sameDay(focused, day);
	}

	onKeydown(event: KeyboardEvent): void {
		const focused = this.focusedDate() ?? new Date(this.viewYear(), this.viewMonth(), 1);
		let newDate: Date | null = null;

		switch (event.key) {
			case 'ArrowLeft':
				newDate = addDays(focused, -1);
				break;
			case 'ArrowRight':
				newDate = addDays(focused, 1);
				break;
			case 'ArrowUp':
				newDate = addDays(focused, -7);
				break;
			case 'ArrowDown':
				newDate = addDays(focused, 7);
				break;
			case 'Enter':
			case ' ':
				this.selectDay(focused);
				event.preventDefault();
				return;
			default:
				return;
		}

		if (newDate) {
			event.preventDefault();
			this.focusedDate.set(newDate);
			if (newDate.getMonth() !== this.viewMonth() || newDate.getFullYear() !== this.viewYear()) {
				this.viewMonth.set(newDate.getMonth());
				this.viewYear.set(newDate.getFullYear());
			}
		}
	}
}

function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

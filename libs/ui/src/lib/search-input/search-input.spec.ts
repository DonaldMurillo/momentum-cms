import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchInput } from './search-input.component';
import { vi } from 'vitest';

describe('SearchInput', () => {
	let fixture: ComponentFixture<SearchInput>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SearchInput],
		}).compileComponents();

		fixture = TestBed.createComponent(SearchInput);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should be a block element', () => {
		expect(fixture.nativeElement.classList.contains('block')).toBe(true);
	});

	it('should render search icon', () => {
		const svg = fixture.nativeElement.querySelector('svg');
		expect(svg).toBeTruthy();
	});

	it('should render input with placeholder', () => {
		const input = fixture.nativeElement.querySelector('input');
		expect(input).toBeTruthy();
	});

	it('should not show clear button when empty', () => {
		const clearButton = fixture.nativeElement.querySelector('button[aria-label="Clear search"]');
		expect(clearButton).toBeFalsy();
	});

	it('should show clear button when has value', async () => {
		fixture.componentInstance.value.set('test');
		fixture.detectChanges();
		await fixture.whenStable();

		const clearButton = fixture.nativeElement.querySelector('button[aria-label="Clear search"]');
		expect(clearButton).toBeTruthy();
	});

	it('should clear value on clear button click', async () => {
		fixture.componentInstance.value.set('test');
		fixture.detectChanges();
		await fixture.whenStable();

		const clearButton = fixture.nativeElement.querySelector('button[aria-label="Clear search"]');
		clearButton.click();
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.componentInstance.value()).toBe('');
	});

	it('should update value on input', async () => {
		// Set value via the signal (simulating the two-way binding behavior)
		fixture.componentInstance.value.set('hello');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.componentInstance.value()).toBe('hello');
		// The input should also reflect the value
		const input = fixture.nativeElement.querySelector('input');
		expect(input.value).toBe('hello');
	});

	it('should apply custom class', async () => {
		fixture.componentRef.setInput('class', 'custom-class');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.classList.contains('custom-class')).toBe(true);
	});

	it('should emit search after debounce delay', async () => {
		vi.useFakeTimers();
		const searchSpy = vi.fn();
		fixture.componentInstance.searchChange.subscribe(searchSpy);

		// Set initial value to trigger the effect
		fixture.componentInstance.value.set('test');
		fixture.detectChanges();

		// Search should not be emitted immediately
		expect(searchSpy).not.toHaveBeenCalled();

		// Advance time by default debounce (300ms)
		vi.advanceTimersByTime(300);

		// Now search should have been emitted
		expect(searchSpy).toHaveBeenCalledWith('test');
	});

	it('should respect custom debounce time', async () => {
		vi.useFakeTimers();
		const searchSpy = vi.fn();

		// Create fresh fixture with custom debounce
		const customFixture = TestBed.createComponent(SearchInput);
		customFixture.componentRef.setInput('debounce', 500);
		customFixture.detectChanges();
		await customFixture.whenStable();

		customFixture.componentInstance.searchChange.subscribe(searchSpy);

		customFixture.componentInstance.value.set('custom');
		customFixture.detectChanges();

		// Not emitted after 300ms
		vi.advanceTimersByTime(300);
		expect(searchSpy).not.toHaveBeenCalled();

		// Emitted after 500ms total
		vi.advanceTimersByTime(200);
		expect(searchSpy).toHaveBeenCalledWith('custom');
	});

	it('should debounce multiple rapid value changes', async () => {
		vi.useFakeTimers();
		const searchSpy = vi.fn();
		fixture.componentInstance.searchChange.subscribe(searchSpy);

		// Rapid changes
		fixture.componentInstance.value.set('a');
		fixture.detectChanges();
		vi.advanceTimersByTime(100);

		fixture.componentInstance.value.set('ab');
		fixture.detectChanges();
		vi.advanceTimersByTime(100);

		fixture.componentInstance.value.set('abc');
		fixture.detectChanges();

		// Only the last value should be emitted after full debounce
		vi.advanceTimersByTime(300);

		// Should only emit once with final value
		expect(searchSpy).toHaveBeenCalledTimes(1);
		expect(searchSpy).toHaveBeenCalledWith('abc');
	});
});

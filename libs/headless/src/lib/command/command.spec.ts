import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HdlCommand } from './command.component';
import { HdlCommandInput } from './command-input.directive';
import { HdlCommandList } from './command-list.component';
import { HdlCommandItem } from './command-item.component';
import { HdlCommandEmpty } from './command-empty.component';

@Component({
	imports: [HdlCommand, HdlCommandInput, HdlCommandList, HdlCommandItem, HdlCommandEmpty],
	template: `
		<hdl-command [(value)]="value">
			<input hdlCommandInput />
			<hdl-command-list>
				<hdl-command-empty>No results</hdl-command-empty>
				<hdl-command-item value="articles">Articles</hdl-command-item>
				<hdl-command-item value="pages">Pages</hdl-command-item>
				<hdl-command-item value="authors" [keywords]="['people', 'writers']"
					>Authors</hdl-command-item
				>
				<hdl-command-item value="settings" [disabled]="true">Settings</hdl-command-item>
			</hdl-command-list>
		</hdl-command>
	`,
})
class TestHost {
	readonly value = signal<string | null>(null);
}

function query(el: HTMLElement, selector: string): HTMLElement {
	return el.querySelector(selector) as HTMLElement;
}

function queryAll(el: HTMLElement, selector: string): HTMLElement[] {
	return Array.from(el.querySelectorAll(selector));
}

function keydown(
	target: HTMLElement,
	key: string,
	modifiers: Partial<KeyboardEventInit> = {},
): void {
	target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }));
}

function typeInto(input: HTMLInputElement, text: string): void {
	input.value = text;
	input.dispatchEvent(new Event('input'));
}

describe('HdlCommand', () => {
	it('should filter command items from the input query', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		typeInto(input, 'auth');
		fixture.detectChanges();

		expect(query(fixture.nativeElement, '[value="articles"]').hasAttribute('hidden')).toBe(true);
		expect(query(fixture.nativeElement, '[value="pages"]').hasAttribute('hidden')).toBe(true);
		expect(query(fixture.nativeElement, '[value="authors"]').hasAttribute('hidden')).toBe(false);
	});

	it('should filter by keywords', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		typeInto(input, 'writers');
		fixture.detectChanges();

		expect(query(fixture.nativeElement, '[value="articles"]').hasAttribute('hidden')).toBe(true);
		expect(query(fixture.nativeElement, '[value="authors"]').hasAttribute('hidden')).toBe(false);
	});

	it('should update the selected value when an item is clicked', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		query(fixture.nativeElement, '[value="pages"]').click();
		fixture.detectChanges();

		expect(fixture.componentInstance.value()).toBe('pages');
	});

	it('should not select a disabled item on click', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		query(fixture.nativeElement, '[value="settings"]').click();
		fixture.detectChanges();

		expect(fixture.componentInstance.value()).toBeNull();
	});

	it('should navigate items with ArrowDown and ArrowUp', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		// ArrowDown to first item
		keydown(input, 'ArrowDown');
		fixture.detectChanges();

		expect(query(fixture.nativeElement, '[value="articles"]').getAttribute('data-active')).toBe(
			'true',
		);
		expect(query(fixture.nativeElement, '[value="pages"]').getAttribute('data-active')).toBeNull();

		// ArrowDown to second item
		keydown(input, 'ArrowDown');
		fixture.detectChanges();

		expect(
			query(fixture.nativeElement, '[value="articles"]').getAttribute('data-active'),
		).toBeNull();
		expect(query(fixture.nativeElement, '[value="pages"]').getAttribute('data-active')).toBe(
			'true',
		);

		// ArrowUp back to first item
		keydown(input, 'ArrowUp');
		fixture.detectChanges();

		expect(query(fixture.nativeElement, '[value="articles"]').getAttribute('data-active')).toBe(
			'true',
		);
		expect(query(fixture.nativeElement, '[value="pages"]').getAttribute('data-active')).toBeNull();
	});

	it('should skip disabled items during keyboard navigation', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		// Navigate to "authors" (3rd enabled item)
		keydown(input, 'ArrowDown');
		keydown(input, 'ArrowDown');
		keydown(input, 'ArrowDown');
		fixture.detectChanges();

		expect(query(fixture.nativeElement, '[value="authors"]').getAttribute('data-active')).toBe(
			'true',
		);

		// ArrowDown should wrap to "articles", skipping disabled "settings"
		keydown(input, 'ArrowDown');
		fixture.detectChanges();

		expect(query(fixture.nativeElement, '[value="articles"]').getAttribute('data-active')).toBe(
			'true',
		);
		expect(
			query(fixture.nativeElement, '[value="settings"]').getAttribute('data-active'),
		).toBeNull();
	});

	it('should select the active item with Enter', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		// Navigate to second item
		keydown(input, 'ArrowDown');
		keydown(input, 'ArrowDown');
		fixture.detectChanges();

		// Enter to select
		keydown(input, 'Enter');
		fixture.detectChanges();

		expect(fixture.componentInstance.value()).toBe('pages');
	});

	it('should wrap navigation at boundaries', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		// ArrowUp from no active item wraps to last enabled item
		keydown(input, 'ArrowUp');
		fixture.detectChanges();

		expect(query(fixture.nativeElement, '[value="authors"]').getAttribute('data-active')).toBe(
			'true',
		);
	});

	it('should keep focus on input during navigation', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		keydown(input, 'ArrowDown');
		fixture.detectChanges();

		expect(document.activeElement).toBe(input);
	});

	it('should set aria-activedescendant on the input', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		expect(input.getAttribute('aria-activedescendant')).toBeNull();

		keydown(input, 'ArrowDown');
		fixture.detectChanges();

		const firstItem = query(fixture.nativeElement, '[value="articles"]');
		expect(input.getAttribute('aria-activedescendant')).toBe(firstItem.id);
	});

	it('should reset active item when query changes', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		keydown(input, 'ArrowDown');
		fixture.detectChanges();
		expect(query(fixture.nativeElement, '[value="articles"]').getAttribute('data-active')).toBe(
			'true',
		);

		typeInto(input, 'p');
		fixture.detectChanges();

		expect(
			query(fixture.nativeElement, '[value="articles"]').getAttribute('data-active'),
		).toBeNull();
	});

	it('should navigate with Ctrl+Home and Ctrl+End', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		// Navigate to middle
		keydown(input, 'ArrowDown');
		keydown(input, 'ArrowDown');
		fixture.detectChanges();
		expect(query(fixture.nativeElement, '[value="pages"]').getAttribute('data-active')).toBe(
			'true',
		);

		// Ctrl+Home to first
		keydown(input, 'Home', { ctrlKey: true });
		fixture.detectChanges();
		expect(query(fixture.nativeElement, '[value="articles"]').getAttribute('data-active')).toBe(
			'true',
		);

		// Ctrl+End to last
		keydown(input, 'End', { ctrlKey: true });
		fixture.detectChanges();
		expect(query(fixture.nativeElement, '[value="authors"]').getAttribute('data-active')).toBe(
			'true',
		);
	});

	it('should show empty state when no items match', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const empty = query(fixture.nativeElement, 'hdl-command-empty');
		expect(empty.hasAttribute('hidden')).toBe(true);

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		typeInto(input, 'zzzznothing');
		fixture.detectChanges();

		expect(empty.hasAttribute('hidden')).toBe(false);
	});

	it('should navigate only visible items after filtering', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		input.focus();

		// Filter to "pages" and "authors" (keyword "people" contains "p")
		typeInto(input, 'p');
		fixture.detectChanges();

		expect(query(fixture.nativeElement, '[value="articles"]').hasAttribute('hidden')).toBe(true);
		expect(query(fixture.nativeElement, '[value="pages"]').hasAttribute('hidden')).toBe(false);
		expect(query(fixture.nativeElement, '[value="authors"]').hasAttribute('hidden')).toBe(false);

		// ArrowDown to first visible (pages)
		keydown(input, 'ArrowDown');
		fixture.detectChanges();
		expect(query(fixture.nativeElement, '[value="pages"]').getAttribute('data-active')).toBe(
			'true',
		);

		// ArrowDown to next visible (authors, skipping hidden articles)
		keydown(input, 'ArrowDown');
		fixture.detectChanges();
		expect(query(fixture.nativeElement, '[value="authors"]').getAttribute('data-active')).toBe(
			'true',
		);

		// Wrap back to first visible
		keydown(input, 'ArrowDown');
		fixture.detectChanges();
		expect(query(fixture.nativeElement, '[value="pages"]').getAttribute('data-active')).toBe(
			'true',
		);
	});

	it('should set correct ARIA attributes on input', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input');
		expect(input.getAttribute('role')).toBe('combobox');
		expect(input.getAttribute('aria-autocomplete')).toBe('list');
		expect(input.getAttribute('aria-expanded')).toBe('true');
		expect(input.getAttribute('aria-controls')).toBeTruthy();

		const list = query(fixture.nativeElement, 'hdl-command-list');
		expect(input.getAttribute('aria-controls')).toBe(list.id);
	});

	it('should set role=listbox on the list and role=option on items', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const list = query(fixture.nativeElement, 'hdl-command-list');
		expect(list.getAttribute('role')).toBe('listbox');

		const items = queryAll(fixture.nativeElement, 'hdl-command-item');
		for (const item of items) {
			expect(item.getAttribute('role')).toBe('option');
		}
	});

	it('should not render aria-disabled="false" on non-disabled items', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const enabledItem = query(fixture.nativeElement, '[value="articles"]');
		expect(enabledItem.getAttribute('aria-disabled')).toBeNull();

		const disabledItem = query(fixture.nativeElement, '[value="settings"]');
		expect(disabledItem.getAttribute('aria-disabled')).toBe('true');
	});

	it('should show empty state when only disabled items match the filter', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const input = query(fixture.nativeElement, 'input') as HTMLInputElement;
		typeInto(input, 'settings');
		fixture.detectChanges();

		// Only the disabled "settings" item matches — empty state should be visible
		const empty = query(fixture.nativeElement, 'hdl-command-empty');
		expect(empty.hasAttribute('hidden')).toBe(false);
	});

	it('should set data-state and aria-selected on selected item', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const articlesItem = query(fixture.nativeElement, '[value="articles"]');
		expect(articlesItem.getAttribute('data-state')).toBe('unselected');
		expect(articlesItem.getAttribute('aria-selected')).toBe('false');

		articlesItem.click();
		fixture.detectChanges();

		expect(articlesItem.getAttribute('data-state')).toBe('selected');
		expect(articlesItem.getAttribute('aria-selected')).toBe('true');
	});
});

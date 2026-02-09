import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Command } from './command.component';
import { CommandInput } from './command-input.component';
import { CommandList } from './command-list.component';
import { CommandEmpty } from './command-empty.component';
import { CommandGroup } from './command-group.component';
import { CommandItem } from './command-item.component';
import { CommandSeparator } from './command-separator.component';

@Component({
	imports: [
		Command,
		CommandInput,
		CommandList,
		CommandEmpty,
		CommandGroup,
		CommandItem,
		CommandSeparator,
	],
	template: `
		<mcms-command>
			<mcms-command-input placeholder="Type a command..." />
			<mcms-command-list>
				<mcms-command-empty>No results found.</mcms-command-empty>
				<mcms-command-group label="Suggestions">
					<mcms-command-item value="calendar">Calendar</mcms-command-item>
					<mcms-command-item value="search">Search Emoji</mcms-command-item>
					<mcms-command-item value="calculator" [disabled]="true">Calculator</mcms-command-item>
				</mcms-command-group>
				<mcms-command-separator />
				<mcms-command-group label="Settings">
					<mcms-command-item value="profile">Profile</mcms-command-item>
					<mcms-command-item value="billing">Billing</mcms-command-item>
				</mcms-command-group>
			</mcms-command-list>
		</mcms-command>
	`,
})
class _TestHostComponent {}

describe('Command', () => {
	let fixture: ComponentFixture<Command>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Command],
		}).compileComponents();

		fixture = TestBed.createComponent(Command);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have flex column layout', () => {
		expect(fixture.nativeElement.classList.contains('flex')).toBe(true);
		expect(fixture.nativeElement.classList.contains('flex-col')).toBe(true);
	});

	it('should have popover styling', () => {
		expect(fixture.nativeElement.classList.contains('bg-popover')).toBe(true);
		expect(fixture.nativeElement.classList.contains('text-popover-foreground')).toBe(true);
	});

	it('should have rounded corners', () => {
		expect(fixture.nativeElement.classList.contains('rounded-md')).toBe(true);
	});

	it('should have default filter mode of manual', () => {
		expect(fixture.componentInstance.filterMode()).toBe('manual');
	});

	it('should be always expanded by default', () => {
		expect(fixture.componentInstance.alwaysExpanded()).toBe(true);
	});
});

describe('CommandInput', () => {
	let fixture: ComponentFixture<CommandInput>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CommandInput],
		}).compileComponents();

		fixture = TestBed.createComponent(CommandInput);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have flex layout', () => {
		expect(fixture.nativeElement.classList.contains('flex')).toBe(true);
		expect(fixture.nativeElement.classList.contains('items-center')).toBe(true);
	});

	it('should have border bottom', () => {
		expect(fixture.nativeElement.classList.contains('border-b')).toBe(true);
	});

	it('should render search icon', () => {
		const svg = fixture.nativeElement.querySelector('svg');
		expect(svg).toBeTruthy();
	});

	it('should render input element', () => {
		const input = fixture.nativeElement.querySelector('input');
		expect(input).toBeTruthy();
	});

	it('should set placeholder', () => {
		fixture.componentRef.setInput('placeholder', 'Search...');
		fixture.detectChanges();
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('placeholder')).toBe('Search...');
	});

	it('should have role="combobox" on input', () => {
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('role')).toBe('combobox');
	});

	it('should have aria-autocomplete="list" on input', () => {
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('aria-autocomplete')).toBe('list');
	});

	it('should not set aria-controls when empty', () => {
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('aria-controls')).toBeNull();
	});

	it('should set aria-controls when provided', () => {
		fixture.componentRef.setInput('ariaControls', 'my-list-id');
		fixture.detectChanges();
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('aria-controls')).toBe('my-list-id');
	});

	it('should default aria-expanded to true', () => {
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('aria-expanded')).toBe('true');
	});

	it('should reflect ariaExpanded input', () => {
		fixture.componentRef.setInput('ariaExpanded', false);
		fixture.detectChanges();
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('aria-expanded')).toBe('false');
	});

	it('should fall back to placeholder for aria-label', () => {
		fixture.componentRef.setInput('placeholder', 'Search items');
		fixture.detectChanges();
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('aria-label')).toBe('Search items');
	});

	it('should use explicit ariaLabel over placeholder', () => {
		fixture.componentRef.setInput('placeholder', 'Search items');
		fixture.componentRef.setInput('ariaLabel', 'Custom label');
		fixture.detectChanges();
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('aria-label')).toBe('Custom label');
	});

	it('should fall back to "Search" when no placeholder or ariaLabel', () => {
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('aria-label')).toBe('Search');
	});

	it('should have aria-hidden on search icon SVG', () => {
		const svg = fixture.nativeElement.querySelector('svg');
		expect(svg.getAttribute('aria-hidden')).toBe('true');
	});
});

describe('CommandEmpty', () => {
	let fixture: ComponentFixture<CommandEmpty>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CommandEmpty],
		}).compileComponents();

		fixture = TestBed.createComponent(CommandEmpty);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have centered text', () => {
		expect(fixture.nativeElement.classList.contains('text-center')).toBe(true);
	});

	it('should have muted foreground text', () => {
		expect(fixture.nativeElement.classList.contains('text-muted-foreground')).toBe(true);
	});

	it('should have padding', () => {
		expect(fixture.nativeElement.classList.contains('py-6')).toBe(true);
	});

	it('should have role="status"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('status');
	});

	it('should have aria-live="polite"', () => {
		expect(fixture.nativeElement.getAttribute('aria-live')).toBe('polite');
	});
});

describe('CommandGroup', () => {
	let fixture: ComponentFixture<CommandGroup>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CommandGroup],
		}).compileComponents();

		fixture = TestBed.createComponent(CommandGroup);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="group"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('group');
	});

	it('should render label when provided', () => {
		fixture.componentRef.setInput('label', 'Test Group');
		fixture.detectChanges();
		const label = fixture.nativeElement.querySelector('div');
		expect(label.textContent).toContain('Test Group');
	});

	it('should not render label when not provided', () => {
		const label = fixture.nativeElement.querySelector('div');
		expect(label).toBeNull();
	});

	it('should set aria-labelledby when label is provided', () => {
		fixture.componentRef.setInput('label', 'Test Group');
		fixture.detectChanges();
		const labelledBy = fixture.nativeElement.getAttribute('aria-labelledby');
		expect(labelledBy).toBeTruthy();
		// The ID should match the label element's id
		const labelEl = fixture.nativeElement.querySelector('div');
		expect(labelEl.getAttribute('id')).toBe(labelledBy);
	});

	it('should not set aria-labelledby when no label', () => {
		expect(fixture.nativeElement.getAttribute('aria-labelledby')).toBeNull();
	});
});

describe('CommandList', () => {
	let fixture: ComponentFixture<CommandList>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CommandList],
		}).compileComponents();

		fixture = TestBed.createComponent(CommandList);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have a unique auto-generated id', () => {
		const id = fixture.nativeElement.getAttribute('id');
		expect(id).toBeTruthy();
		expect(id).toMatch(/^mcms-command-list-\d+$/);
	});

	it('should have role="listbox"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('listbox');
	});
});

describe('CommandSeparator', () => {
	let fixture: ComponentFixture<CommandSeparator>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CommandSeparator],
		}).compileComponents();

		fixture = TestBed.createComponent(CommandSeparator);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="separator"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('separator');
	});

	it('should have border styling', () => {
		expect(fixture.nativeElement.classList.contains('bg-border')).toBe(true);
	});

	it('should be displayed as block', () => {
		expect(fixture.nativeElement.classList.contains('block')).toBe(true);
	});
});

describe('Command Integration', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render command structure', () => {
		const command = fixture.nativeElement.querySelector('mcms-command');
		expect(command).toBeTruthy();
	});

	it('should render command input', () => {
		const input = fixture.nativeElement.querySelector('mcms-command-input');
		expect(input).toBeTruthy();
	});

	it('should render command list', () => {
		const list = fixture.nativeElement.querySelector('mcms-command-list');
		expect(list).toBeTruthy();
	});

	it('should render command empty', () => {
		const empty = fixture.nativeElement.querySelector('mcms-command-empty');
		expect(empty).toBeTruthy();
		expect(empty.textContent).toContain('No results found.');
	});

	it('should render groups', () => {
		const groups = fixture.nativeElement.querySelectorAll('mcms-command-group');
		expect(groups.length).toBe(2);
	});

	it('should render items', () => {
		const items = fixture.nativeElement.querySelectorAll('mcms-command-item');
		expect(items.length).toBe(5);
	});

	it('should render separator', () => {
		const separator = fixture.nativeElement.querySelector('mcms-command-separator');
		expect(separator).toBeTruthy();
	});

	it('should show input placeholder', () => {
		const input = fixture.nativeElement.querySelector('input');
		expect(input.getAttribute('placeholder')).toBe('Type a command...');
	});

	it('should show group labels', () => {
		const labels = fixture.nativeElement.querySelectorAll('mcms-command-group > div');
		expect(labels.length).toBe(2);
		expect(labels[0].textContent).toContain('Suggestions');
		expect(labels[1].textContent).toContain('Settings');
	});

	it('should have aria-labelledby on groups with labels', () => {
		const groups = fixture.nativeElement.querySelectorAll('mcms-command-group');
		for (const group of groups) {
			const labelledBy = group.getAttribute('aria-labelledby');
			expect(labelledBy).toBeTruthy();
			const labelEl = group.querySelector(`#${labelledBy}`);
			expect(labelEl).toBeTruthy();
		}
	});

	it('should have unique id on command list', () => {
		const list = fixture.nativeElement.querySelector('mcms-command-list');
		expect(list.getAttribute('id')).toMatch(/^mcms-command-list-\d+$/);
	});
});

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTable } from './data-table.component';
import type { DataTableColumn, DataTableRowAction } from './data-table.types';

interface TestUser {
	id: number;
	name: string;
	email: string;
	role: string;
}

const testUsers: TestUser[] = [
	{ id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
	{ id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
	{ id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' },
	{ id: 4, name: 'Diana', email: 'diana@example.com', role: 'editor' },
	{ id: 5, name: 'Eve', email: 'eve@example.com', role: 'admin' },
];

const testColumns: DataTableColumn<TestUser>[] = [
	{ field: 'name', header: 'Name', sortable: true },
	{ field: 'email', header: 'Email', sortable: true },
	{ field: 'role', header: 'Role' },
];

@Component({
	imports: [DataTable],
	template: `
		<mcms-data-table
			[data]="data()"
			[columns]="columns"
			[loading]="loading()"
			[searchable]="searchable()"
			[selectable]="selectable()"
			[paginated]="paginated()"
			[pageSize]="pageSize"
			[rowActions]="rowActions"
			[(selectedItems)]="selectedItems"
			(searchChange)="onSearchChange($event)"
			(rowClick)="onRowClick($event)"
			(selectionChange)="onSelectionChange($event)"
			(rowAction)="onRowAction($event)"
		/>
	`,
})
class _TestHostComponent {
	data = signal<TestUser[]>(testUsers);
	columns = testColumns;
	loading = signal(false);
	searchable = signal(true);
	selectable = signal(false);
	paginated = signal(true);
	pageSize = 3;
	rowActions: DataTableRowAction<TestUser>[] = [];
	selectedItems: TestUser[] = [];

	lastSearch = '';
	lastClickedRow: TestUser | null = null;
	lastSelectionChange: TestUser[] = [];
	lastRowAction: { action: DataTableRowAction<TestUser>; item: TestUser } | null = null;

	onSearchChange(query: string): void {
		this.lastSearch = query;
	}

	onRowClick(item: TestUser): void {
		this.lastClickedRow = item;
	}

	onSelectionChange(items: TestUser[]): void {
		this.lastSelectionChange = items;
	}

	onRowAction(event: { action: DataTableRowAction<TestUser>; item: TestUser }): void {
		this.lastRowAction = event;
	}
}

describe('DataTable', () => {
	let fixture: ComponentFixture<DataTable<TestUser>>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DataTable],
		}).compileComponents();

		fixture = TestBed.createComponent(DataTable<TestUser>);
		fixture.componentRef.setInput('data', testUsers);
		fixture.componentRef.setInput('columns', testColumns);
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

describe('DataTable Rendering', () => {
	let fixture: ComponentFixture<_TestHostComponent>;
	let component: _TestHostComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render table headers', () => {
		const headers = fixture.nativeElement.querySelectorAll('mcms-table-head');
		expect(headers.length).toBe(3);
		expect(headers[0].textContent).toContain('Name');
		expect(headers[1].textContent).toContain('Email');
		expect(headers[2].textContent).toContain('Role');
	});

	it('should render table rows with pagination', () => {
		const rows = fixture.nativeElement.querySelectorAll('mcms-table-body mcms-table-row');
		expect(rows.length).toBe(3); // pageSize is 3
	});

	it('should render cell values', () => {
		const cells = fixture.nativeElement.querySelectorAll('mcms-table-body mcms-table-cell');
		expect(cells[0].textContent).toContain('Alice');
		expect(cells[1].textContent).toContain('alice@example.com');
		expect(cells[2].textContent).toContain('admin');
	});

	it('should show loading skeleton', async () => {
		component.loading.set(true);
		fixture.detectChanges();
		await fixture.whenStable();

		const skeletons = fixture.nativeElement.querySelectorAll('mcms-skeleton');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it('should show empty state when no data', async () => {
		component.data.set([]);
		fixture.detectChanges();
		await fixture.whenStable();

		const emptyState = fixture.nativeElement.querySelector('mcms-empty-state');
		expect(emptyState).toBeTruthy();
	});
});

describe('DataTable Search', () => {
	let fixture: ComponentFixture<_TestHostComponent>;
	let component: _TestHostComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		component = fixture.componentInstance;
		component.paginated.set(false); // Disable pagination for easier testing
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render search input when searchable', () => {
		const searchInput = fixture.nativeElement.querySelector('mcms-search-input');
		expect(searchInput).toBeTruthy();
	});

	it('should not render search input when not searchable', async () => {
		component.searchable.set(false);
		fixture.detectChanges();
		await fixture.whenStable();

		const searchInput = fixture.nativeElement.querySelector('mcms-search-input');
		expect(searchInput).toBeFalsy();
	});

	it('should filter data on search', async () => {
		// Get the DataTable component directly to set the search query
		const dataTable = fixture.debugElement.children[0].componentInstance as DataTable<TestUser>;

		// Directly set the search query to bypass debounce
		dataTable.searchQuery.set('alice');
		fixture.detectChanges();
		await fixture.whenStable();

		const rows = fixture.nativeElement.querySelectorAll('mcms-table-body mcms-table-row');
		expect(rows.length).toBe(1);
		expect(rows[0].textContent).toContain('Alice');
	});
});

describe('DataTable Sorting', () => {
	let fixture: ComponentFixture<_TestHostComponent>;
	let component: _TestHostComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		component = fixture.componentInstance;
		component.paginated.set(false);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should show sort indicator on sortable columns', () => {
		const nameHeader = fixture.nativeElement.querySelectorAll('mcms-table-head')[0];
		expect(nameHeader.classList.contains('cursor-pointer')).toBe(true);
	});

	it('should sort ascending on first click', async () => {
		const nameHeader = fixture.nativeElement.querySelectorAll('mcms-table-head')[0];
		nameHeader.click();
		fixture.detectChanges();
		await fixture.whenStable();

		const firstCell = fixture.nativeElement.querySelector('mcms-table-body mcms-table-cell');
		expect(firstCell.textContent).toContain('Alice');
	});

	it('should sort descending on second click', async () => {
		const nameHeader = fixture.nativeElement.querySelectorAll('mcms-table-head')[0];

		// First click - ascending
		nameHeader.click();
		fixture.detectChanges();
		await fixture.whenStable();

		// Second click - descending
		nameHeader.click();
		fixture.detectChanges();
		await fixture.whenStable();

		const firstCell = fixture.nativeElement.querySelector('mcms-table-body mcms-table-cell');
		expect(firstCell.textContent).toContain('Eve');
	});
});

describe('DataTable Selection', () => {
	let fixture: ComponentFixture<_TestHostComponent>;
	let component: _TestHostComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		component = fixture.componentInstance;
		component.selectable.set(true);
		component.paginated.set(false);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should show checkboxes when selectable', () => {
		const checkboxes = fixture.nativeElement.querySelectorAll('mcms-checkbox');
		// 1 header checkbox + 5 row checkboxes
		expect(checkboxes.length).toBe(6);
	});

	it('should select row on checkbox click', async () => {
		const rowCheckbox = fixture.nativeElement.querySelectorAll('mcms-table-body mcms-checkbox')[0];
		const button = rowCheckbox.querySelector('button');
		button.click();
		fixture.detectChanges();
		await fixture.whenStable();

		// Verify selectedItems is updated
		expect(component.selectedItems.length).toBe(1);
		expect(component.selectedItems[0].name).toBe('Alice');
		// Verify selectionChange output was emitted
		expect(component.lastSelectionChange.length).toBe(1);
		expect(component.lastSelectionChange[0].name).toBe('Alice');
	});

	it('should select all on header checkbox click', async () => {
		const headerCheckbox = fixture.nativeElement.querySelector(
			'mcms-table-header mcms-checkbox button',
		);
		headerCheckbox.click();
		fixture.detectChanges();
		await fixture.whenStable();

		// Verify all items selected
		expect(component.selectedItems.length).toBe(5);
		// Verify selectionChange output was emitted with all items
		expect(component.lastSelectionChange.length).toBe(5);
	});
});

describe('DataTable Pagination', () => {
	let fixture: ComponentFixture<_TestHostComponent>;
	let component: _TestHostComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		component = fixture.componentInstance;
		component.pageSize = 2;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should show pagination when enabled', () => {
		const pagination = fixture.nativeElement.querySelector('mcms-pagination');
		expect(pagination).toBeTruthy();
	});

	it('should show correct item count', () => {
		const countText = fixture.nativeElement.textContent;
		expect(countText).toContain('Showing 1-2 of 5');
	});

	it('should limit displayed rows to pageSize', () => {
		const rows = fixture.nativeElement.querySelectorAll('mcms-table-body mcms-table-row');
		expect(rows.length).toBe(2);
	});
});

describe('DataTable Row Actions', () => {
	let fixture: ComponentFixture<_TestHostComponent>;
	let component: _TestHostComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		component = fixture.componentInstance;
		component.rowActions = [
			{
				id: 'edit',
				label: 'Edit',
			},
			{
				id: 'delete',
				label: 'Delete',
				variant: 'destructive',
			},
		];
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should show action button when row actions defined', () => {
		const actionButtons = fixture.nativeElement.querySelectorAll(
			'mcms-table-body button[mcms-button]',
		);
		expect(actionButtons.length).toBe(3); // 3 rows on first page
	});

	it('should emit rowAction when action is clicked', async () => {
		// Open the dropdown menu for the first row
		const actionButton = fixture.nativeElement.querySelector('mcms-table-body button[mcms-button]');
		actionButton.click();
		fixture.detectChanges();
		await fixture.whenStable();

		// Find and click the Edit action in the dropdown
		const dropdownItems = document.querySelectorAll('button[mcms-dropdown-item]');
		const editButton = Array.from(dropdownItems).find((el) => el.textContent?.includes('Edit'));
		expect(editButton).toBeTruthy();

		if (editButton) {
			(editButton as HTMLElement).click();
			fixture.detectChanges();
			await fixture.whenStable();

			// Verify rowAction output was emitted with correct data
			expect(component.lastRowAction).toBeTruthy();
			expect(component.lastRowAction?.action.id).toBe('edit');
			expect(component.lastRowAction?.item.name).toBe('Alice');
		}
	});
});

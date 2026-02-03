import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Table } from './table.component';
import { TableHeader } from './table-header.component';
import { TableBody } from './table-body.component';
import { TableRow } from './table-row.component';
import { TableHead } from './table-head.component';
import { TableCell } from './table-cell.component';
import { TableCaption } from './table-caption.component';
import { TableFooter } from './table-footer.component';

@Component({
	imports: [
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell,
		TableCaption,
		TableFooter,
	],
	template: `
		<mcms-table>
			<mcms-table-caption>A list of users</mcms-table-caption>
			<mcms-table-header>
				<mcms-table-row>
					<mcms-table-head role="columnheader">Name</mcms-table-head>
					<mcms-table-head role="columnheader">Email</mcms-table-head>
					<mcms-table-head role="columnheader">Status</mcms-table-head>
				</mcms-table-row>
			</mcms-table-header>
			<mcms-table-body>
				<mcms-table-row>
					<mcms-table-cell>John Doe</mcms-table-cell>
					<mcms-table-cell>john&#64;example.com</mcms-table-cell>
					<mcms-table-cell>Active</mcms-table-cell>
				</mcms-table-row>
				<mcms-table-row [selected]="true">
					<mcms-table-cell>Jane Smith</mcms-table-cell>
					<mcms-table-cell>jane&#64;example.com</mcms-table-cell>
					<mcms-table-cell>Inactive</mcms-table-cell>
				</mcms-table-row>
			</mcms-table-body>
			<mcms-table-footer>
				<mcms-table-row>
					<mcms-table-cell [colSpan]="3">Total: 2 users</mcms-table-cell>
				</mcms-table-row>
			</mcms-table-footer>
		</mcms-table>
	`,
})
class _TestHostComponent {}

describe('Table', () => {
	let fixture: ComponentFixture<Table>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Table],
		}).compileComponents();

		fixture = TestBed.createComponent(Table);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have overflow-auto', () => {
		expect(fixture.nativeElement.classList.contains('overflow-auto')).toBe(true);
	});

	it('should have relative positioning', () => {
		expect(fixture.nativeElement.classList.contains('relative')).toBe(true);
	});

	it('should have role="grid"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('grid');
	});
});

describe('TableHeader', () => {
	let fixture: ComponentFixture<TableHeader>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TableHeader],
		}).compileComponents();

		fixture = TestBed.createComponent(TableHeader);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});

describe('TableBody', () => {
	let fixture: ComponentFixture<TableBody>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TableBody],
		}).compileComponents();

		fixture = TestBed.createComponent(TableBody);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});

describe('TableCaption', () => {
	let fixture: ComponentFixture<TableCaption>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TableCaption],
		}).compileComponents();

		fixture = TestBed.createComponent(TableCaption);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have muted foreground text', () => {
		expect(fixture.nativeElement.classList.contains('text-muted-foreground')).toBe(true);
	});
});

describe('TableFooter', () => {
	let fixture: ComponentFixture<TableFooter>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TableFooter],
		}).compileComponents();

		fixture = TestBed.createComponent(TableFooter);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have border-top', () => {
		expect(fixture.nativeElement.classList.contains('border-t')).toBe(true);
	});
});

describe('Table Integration', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render table structure', () => {
		const table = fixture.nativeElement.querySelector('mcms-table');
		expect(table).toBeTruthy();
	});

	it('should render caption', () => {
		const caption = fixture.nativeElement.querySelector('mcms-table-caption');
		expect(caption).toBeTruthy();
		expect(caption.textContent).toContain('A list of users');
	});

	it('should render header row with 3 columns', () => {
		const headerCells = fixture.nativeElement.querySelectorAll('mcms-table-head');
		expect(headerCells.length).toBe(3);
	});

	it('should render 2 data rows', () => {
		const bodyRows = fixture.nativeElement.querySelectorAll('mcms-table-body mcms-table-row');
		expect(bodyRows.length).toBe(2);
	});

	it('should render footer', () => {
		const footer = fixture.nativeElement.querySelector('mcms-table-footer');
		expect(footer).toBeTruthy();
	});

	it('should apply selected styling to selected row', () => {
		const selectedRow = fixture.nativeElement.querySelectorAll('mcms-table-body mcms-table-row')[1];
		expect(selectedRow.classList.contains('bg-muted')).toBe(true);
	});

	it('should have header cells with columnheader role', () => {
		const headerCell = fixture.nativeElement.querySelector('mcms-table-head');
		expect(headerCell.getAttribute('role')).toBe('columnheader');
	});

	it('should have data cells with gridcell role', () => {
		const dataCell = fixture.nativeElement.querySelector('mcms-table-cell');
		expect(dataCell.getAttribute('role')).toBe('gridcell');
	});
});

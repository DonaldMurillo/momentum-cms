import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlGrid } from './grid.component';
import { HdlGridRow } from './grid-row.component';
import { HdlGridCell } from './grid-cell.component';

@Component({
	imports: [HdlGrid, HdlGridRow, HdlGridCell],
	template: `
		<hdl-grid>
			<hdl-grid-row>
				<hdl-grid-cell>Cell 1</hdl-grid-cell>
				<hdl-grid-cell>Cell 2</hdl-grid-cell>
			</hdl-grid-row>
			<hdl-grid-row>
				<hdl-grid-cell>Cell 3</hdl-grid-cell>
				<hdl-grid-cell>Cell 4</hdl-grid-cell>
			</hdl-grid-row>
		</hdl-grid>
	`,
})
class TestHost {}

describe('HdlGrid', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();
	});

	it('should render grid rows', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const rows = fixture.nativeElement.querySelectorAll('hdl-grid-row');
		expect(rows.length).toBe(2);
	});

	it('should render grid cells', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const cells = fixture.nativeElement.querySelectorAll('hdl-grid-cell');
		expect(cells.length).toBe(4);
	});

	it('should render cell text content', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const cells = fixture.nativeElement.querySelectorAll('hdl-grid-cell');
		expect(cells[0].textContent).toContain('Cell 1');
		expect(cells[3].textContent).toContain('Cell 4');
	});

	it('should have role="grid" on the host', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const el = fixture.nativeElement.querySelector('hdl-grid');
		expect(el.getAttribute('role')).toBe('grid');
	});

	it('should have role="row" on grid rows', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const rows = fixture.nativeElement.querySelectorAll('hdl-grid-row');
		expect(rows[0].getAttribute('role')).toBe('row');
	});

	it('should have role="gridcell" on grid cells', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const cells = fixture.nativeElement.querySelectorAll('hdl-grid-cell');
		expect(cells[0].getAttribute('role')).toBe('gridcell');
	});

	it('should update active state when a cell receives focus', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const cells: HTMLElement[] = Array.from(
			fixture.nativeElement.querySelectorAll('hdl-grid-cell'),
		);

		cells[0].focus();
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const cellDebug = fixture.debugElement.query((de) => de.nativeElement === cells[0]);
		expect(cellDebug).toBeTruthy();
		if (!cellDebug) throw new Error('Expected debug element for focused cell');
		const comp = cellDebug.componentInstance as HdlGridCell;
		expect(comp.gridCell.active()).toBe(true);
	});

	it('should expose styling contract attributes on grid rows and cells', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const grid = fixture.nativeElement.querySelector('hdl-grid');
		const rows = fixture.nativeElement.querySelectorAll('hdl-grid-row');
		const cells = fixture.nativeElement.querySelectorAll('hdl-grid-cell');

		expect(grid.getAttribute('data-slot')).toBe('grid');
		expect(rows[0].getAttribute('data-slot')).toBe('grid-row');
		expect(cells[0].getAttribute('data-slot')).toBe('grid-cell');
		expect(cells[0].getAttribute('data-state')).toBe('unselected');
	});

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-grid');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});

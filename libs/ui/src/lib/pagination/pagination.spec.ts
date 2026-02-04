import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pagination } from './pagination.component';
import { generatePaginationItems } from './pagination.types';

describe('generatePaginationItems', () => {
	it('should return [1] for single page', () => {
		expect(generatePaginationItems(1, 1)).toEqual([1]);
	});

	it('should return [1, 2] for two pages', () => {
		expect(generatePaginationItems(1, 2)).toEqual([1, 2]);
	});

	it('should return all pages for small total', () => {
		expect(generatePaginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
	});

	it('should add right ellipsis for large total at start', () => {
		const items = generatePaginationItems(1, 10);
		expect(items).toContain('ellipsis');
		expect(items[0]).toBe(1);
		expect(items[items.length - 1]).toBe(10);
	});

	it('should add left ellipsis for large total at end', () => {
		const items = generatePaginationItems(10, 10);
		expect(items).toContain('ellipsis');
		expect(items[0]).toBe(1);
		expect(items[items.length - 1]).toBe(10);
	});

	it('should add both ellipses for large total in middle', () => {
		const items = generatePaginationItems(5, 10);
		const ellipsisCount = items.filter((i) => i === 'ellipsis').length;
		expect(ellipsisCount).toBe(2);
	});

	it('should respect siblingCount', () => {
		const items = generatePaginationItems(5, 10, 2);
		expect(items).toContain(3);
		expect(items).toContain(4);
		expect(items).toContain(5);
		expect(items).toContain(6);
		expect(items).toContain(7);
	});
});

describe('Pagination', () => {
	let fixture: ComponentFixture<Pagination>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Pagination],
		}).compileComponents();

		fixture = TestBed.createComponent(Pagination);
		fixture.componentRef.setInput('currentPage', 1);
		fixture.componentRef.setInput('totalPages', 10);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="navigation"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('navigation');
	});

	it('should have aria-label="Pagination"', () => {
		expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Pagination');
	});

	it('should render previous button', () => {
		const prevBtn = fixture.nativeElement.querySelector('button[aria-label="Go to previous page"]');
		expect(prevBtn).toBeTruthy();
	});

	it('should render next button', () => {
		const nextBtn = fixture.nativeElement.querySelector('button[aria-label="Go to next page"]');
		expect(nextBtn).toBeTruthy();
	});

	it('should disable previous button on first page', () => {
		fixture.componentRef.setInput('currentPage', 1);
		fixture.detectChanges();
		const prevBtn = fixture.nativeElement.querySelector('button[aria-label="Go to previous page"]');
		expect(prevBtn.disabled).toBe(true);
	});

	it('should disable next button on last page', () => {
		fixture.componentRef.setInput('currentPage', 10);
		fixture.detectChanges();
		const nextBtn = fixture.nativeElement.querySelector('button[aria-label="Go to next page"]');
		expect(nextBtn.disabled).toBe(true);
	});

	it('should enable both buttons in middle', () => {
		fixture.componentRef.setInput('currentPage', 5);
		fixture.detectChanges();
		const prevBtn = fixture.nativeElement.querySelector('button[aria-label="Go to previous page"]');
		const nextBtn = fixture.nativeElement.querySelector('button[aria-label="Go to next page"]');
		expect(prevBtn.disabled).toBe(false);
		expect(nextBtn.disabled).toBe(false);
	});

	it('should emit pageChange when clicking a page', () => {
		fixture.componentRef.setInput('currentPage', 1);
		fixture.detectChanges();

		const spy = vi.spyOn(fixture.componentInstance.pageChange, 'emit');

		// Find button for page 2
		const buttons = fixture.nativeElement.querySelectorAll('button');
		const page2Btn = Array.from(buttons).find(
			(btn) => (btn as HTMLElement).textContent?.trim() === '2',
		) as HTMLButtonElement;
		page2Btn?.click();

		expect(spy).toHaveBeenCalledWith(2);
	});

	it('should emit pageChange when clicking previous', () => {
		fixture.componentRef.setInput('currentPage', 5);
		fixture.detectChanges();

		const spy = vi.spyOn(fixture.componentInstance.pageChange, 'emit');
		const prevBtn = fixture.nativeElement.querySelector('button[aria-label="Go to previous page"]');
		prevBtn.click();

		expect(spy).toHaveBeenCalledWith(4);
	});

	it('should emit pageChange when clicking next', () => {
		fixture.componentRef.setInput('currentPage', 5);
		fixture.detectChanges();

		const spy = vi.spyOn(fixture.componentInstance.pageChange, 'emit');
		const nextBtn = fixture.nativeElement.querySelector('button[aria-label="Go to next page"]');
		nextBtn.click();

		expect(spy).toHaveBeenCalledWith(6);
	});

	it('should mark current page with aria-current="page"', () => {
		fixture.componentRef.setInput('currentPage', 5);
		fixture.detectChanges();

		const currentBtn = fixture.nativeElement.querySelector('button[aria-current="page"]');
		expect(currentBtn).toBeTruthy();
		expect(currentBtn.textContent?.trim()).toBe('5');
	});

	it('should not emit when clicking current page', () => {
		fixture.componentRef.setInput('currentPage', 1);
		fixture.detectChanges();

		const spy = vi.spyOn(fixture.componentInstance.pageChange, 'emit');
		const currentBtn = fixture.nativeElement.querySelector('button[aria-current="page"]');
		currentBtn?.click();

		expect(spy).not.toHaveBeenCalled();
	});
});

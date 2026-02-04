import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Breadcrumbs } from './breadcrumbs.component';
import { BreadcrumbItem } from './breadcrumb-item.component';
import { BreadcrumbSeparator } from './breadcrumb-separator.component';

@Component({
	imports: [Breadcrumbs, BreadcrumbItem, BreadcrumbSeparator],
	template: `
		<mcms-breadcrumbs>
			<mcms-breadcrumb-item href="/">Home</mcms-breadcrumb-item>
			<mcms-breadcrumb-separator />
			<mcms-breadcrumb-item href="/products">Products</mcms-breadcrumb-item>
			<mcms-breadcrumb-separator />
			<mcms-breadcrumb-item [current]="true">Details</mcms-breadcrumb-item>
		</mcms-breadcrumbs>
	`,
})
class _TestHostComponent {}

describe('Breadcrumbs', () => {
	let fixture: ComponentFixture<Breadcrumbs>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Breadcrumbs],
		}).compileComponents();

		fixture = TestBed.createComponent(Breadcrumbs);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should render nav element', () => {
		const nav = fixture.nativeElement.querySelector('nav');
		expect(nav).toBeTruthy();
	});

	it('should have aria-label="Breadcrumb"', () => {
		const nav = fixture.nativeElement.querySelector('nav');
		expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
	});

	it('should render ol element', () => {
		const ol = fixture.nativeElement.querySelector('ol');
		expect(ol).toBeTruthy();
	});
});

describe('BreadcrumbItem', () => {
	let fixture: ComponentFixture<BreadcrumbItem>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BreadcrumbItem],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(BreadcrumbItem);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should render span when no href', () => {
		fixture.detectChanges();
		const span = fixture.nativeElement.querySelector('span');
		expect(span).toBeTruthy();
	});

	it('should render link when href is provided', () => {
		fixture.componentRef.setInput('href', '/test');
		fixture.detectChanges();
		const link = fixture.nativeElement.querySelector('a');
		expect(link).toBeTruthy();
		// RouterLink sets href attribute after navigation setup
		expect(link.hasAttribute('href')).toBe(true);
	});

	it('should have aria-current="page" when current', () => {
		fixture.componentRef.setInput('current', true);
		fixture.detectChanges();
		const span = fixture.nativeElement.querySelector('span');
		expect(span.getAttribute('aria-current')).toBe('page');
	});

	it('should not have aria-current when not current', () => {
		fixture.detectChanges();
		const span = fixture.nativeElement.querySelector('span');
		expect(span.getAttribute('aria-current')).toBeNull();
	});

	it('should apply font-medium when current', () => {
		fixture.componentRef.setInput('current', true);
		fixture.detectChanges();
		const span = fixture.nativeElement.querySelector('span');
		expect(span.classList.contains('font-medium')).toBe(true);
	});

	it('should render span instead of link when current with href', () => {
		fixture.componentRef.setInput('href', '/test');
		fixture.componentRef.setInput('current', true);
		fixture.detectChanges();
		const span = fixture.nativeElement.querySelector('span');
		const link = fixture.nativeElement.querySelector('a');
		expect(span).toBeTruthy();
		expect(link).toBeNull();
	});
});

describe('BreadcrumbSeparator', () => {
	let fixture: ComponentFixture<BreadcrumbSeparator>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BreadcrumbSeparator],
		}).compileComponents();

		fixture = TestBed.createComponent(BreadcrumbSeparator);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="presentation"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('presentation');
	});

	it('should have aria-hidden="true"', () => {
		expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
	});

	it('should render default chevron SVG', () => {
		const svg = fixture.nativeElement.querySelector('svg');
		expect(svg).toBeTruthy();
	});
});

describe('Breadcrumbs Integration', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		await fixture.whenStable();
	});

	it('should render all breadcrumb items', () => {
		const items = fixture.nativeElement.querySelectorAll('mcms-breadcrumb-item');
		expect(items.length).toBe(3);
	});

	it('should render all separators', () => {
		const separators = fixture.nativeElement.querySelectorAll('mcms-breadcrumb-separator');
		expect(separators.length).toBe(2);
	});

	it('should have correct structure', () => {
		const nav = fixture.nativeElement.querySelector('nav');
		const ol = nav.querySelector('ol');
		expect(nav).toBeTruthy();
		expect(ol).toBeTruthy();
	});
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldDisplay } from './field-display.component';

describe('FieldDisplay', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('value', 'Test Value');
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

describe('FieldDisplay Text Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
	});

	it('should display text value', async () => {
		fixture.componentRef.setInput('value', 'Hello World');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('Hello World');
	});

	it('should display empty text for null', async () => {
		fixture.componentRef.setInput('value', null);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('-');
	});

	it('should display custom empty text', async () => {
		fixture.componentRef.setInput('value', null);
		fixture.componentRef.setInput('emptyText', 'N/A');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('N/A');
	});

	it('should display label when provided', async () => {
		fixture.componentRef.setInput('value', 'Test');
		fixture.componentRef.setInput('label', 'My Label');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('My Label');
		expect(fixture.nativeElement.textContent).toContain('Test');
	});
});

describe('FieldDisplay Number Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('type', 'number');
	});

	it('should format number with locale', async () => {
		fixture.componentRef.setInput('value', 1234567);
		fixture.detectChanges();
		await fixture.whenStable();

		// Verify the formatted number matches locale output
		const text = fixture.nativeElement.textContent.trim();
		const expected = (1234567).toLocaleString();
		expect(text).toBe(expected);
	});

	it('should display empty text for invalid number', async () => {
		fixture.componentRef.setInput('value', 'not a number');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('-');
	});
});

describe('FieldDisplay Date Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('type', 'date');
	});

	it('should format date', async () => {
		fixture.componentRef.setInput('value', '2024-01-15');
		fixture.detectChanges();
		await fixture.whenStable();

		// Verify the date is formatted using toLocaleDateString
		const text = fixture.nativeElement.textContent.trim();
		const expected = new Date('2024-01-15').toLocaleDateString();
		expect(text).toBe(expected);
	});

	it('should handle Date object', async () => {
		const dateValue = new Date('2024-06-15');
		fixture.componentRef.setInput('value', dateValue);
		fixture.detectChanges();
		await fixture.whenStable();

		// Verify date object is formatted correctly
		const text = fixture.nativeElement.textContent.trim();
		const expected = dateValue.toLocaleDateString();
		expect(text).toBe(expected);
	});

	it('should display empty text for invalid date', async () => {
		fixture.componentRef.setInput('value', 'invalid-date');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('-');
	});
});

describe('FieldDisplay Boolean Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('type', 'boolean');
	});

	it('should display Yes for true', async () => {
		fixture.componentRef.setInput('value', true);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('Yes');
	});

	it('should display No for false', async () => {
		fixture.componentRef.setInput('value', false);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('No');
	});
});

describe('FieldDisplay Badge Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('type', 'badge');
	});

	it('should render badge', async () => {
		fixture.componentRef.setInput('value', 'active');
		fixture.detectChanges();
		await fixture.whenStable();

		const badge = fixture.nativeElement.querySelector('mcms-badge');
		expect(badge).toBeTruthy();
		expect(badge.textContent).toContain('active');
	});

	it('should use success variant for active status', async () => {
		fixture.componentRef.setInput('value', 'active');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.componentInstance.badgeVariant()).toBe('success');
	});

	it('should use destructive variant for error status', async () => {
		fixture.componentRef.setInput('value', 'error');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.componentInstance.badgeVariant()).toBe('destructive');
	});
});

describe('FieldDisplay Link Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('type', 'link');
	});

	it('should render link', async () => {
		fixture.componentRef.setInput('value', 'https://example.com');
		fixture.detectChanges();
		await fixture.whenStable();

		const link = fixture.nativeElement.querySelector('a');
		expect(link).toBeTruthy();
		expect(link.getAttribute('href')).toBe('https://example.com');
	});

	it('should open in new tab by default', async () => {
		fixture.componentRef.setInput('value', 'https://example.com');
		fixture.detectChanges();
		await fixture.whenStable();

		const link = fixture.nativeElement.querySelector('a');
		expect(link.getAttribute('target')).toBe('_blank');
	});
});

describe('FieldDisplay Email Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('type', 'email');
	});

	it('should render mailto link', async () => {
		fixture.componentRef.setInput('value', 'test@example.com');
		fixture.detectChanges();
		await fixture.whenStable();

		const link = fixture.nativeElement.querySelector('a');
		expect(link).toBeTruthy();
		expect(link.getAttribute('href')).toBe('mailto:test@example.com');
	});
});

describe('FieldDisplay List Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('type', 'list');
	});

	it('should render list items', async () => {
		fixture.componentRef.setInput('value', ['Item 1', 'Item 2', 'Item 3']);
		fixture.detectChanges();
		await fixture.whenStable();

		const items = fixture.nativeElement.querySelectorAll('li');
		expect(items.length).toBe(3);
	});

	it('should truncate list at maxItems', async () => {
		fixture.componentRef.setInput('value', ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
		fixture.componentRef.setInput('maxItems', 3);
		fixture.detectChanges();
		await fixture.whenStable();

		const items = fixture.nativeElement.querySelectorAll('li');
		expect(items.length).toBe(3);
		expect(fixture.nativeElement.textContent).toContain('+4 more');
	});
});

describe('FieldDisplay JSON Type', () => {
	let fixture: ComponentFixture<FieldDisplay>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FieldDisplay],
		}).compileComponents();

		fixture = TestBed.createComponent(FieldDisplay);
		fixture.componentRef.setInput('type', 'json');
	});

	it('should render JSON in pre element', async () => {
		fixture.componentRef.setInput('value', { key: 'value' });
		fixture.detectChanges();
		await fixture.whenStable();

		const pre = fixture.nativeElement.querySelector('pre');
		expect(pre).toBeTruthy();
		expect(pre.textContent).toContain('"key"');
		expect(pre.textContent).toContain('"value"');
	});
});

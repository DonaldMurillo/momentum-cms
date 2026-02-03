import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state.component';

@Component({
	imports: [EmptyState],
	template: `
		<mcms-empty-state [title]="title" [description]="description" [size]="size">
			<svg mcms-empty-state-icon class="h-12 w-12 text-muted-foreground">
				<circle cx="12" cy="12" r="10" />
			</svg>
			<button mcms-empty-state-action>Create New</button>
		</mcms-empty-state>
	`,
})
class _TestHostComponent {
	title = 'No results found';
	description = 'Try adjusting your search criteria';
	size: 'sm' | 'md' | 'lg' = 'md';
}

@Component({
	imports: [EmptyState],
	template: `
		<mcms-empty-state>
			<svg mcms-empty-state-icon class="h-12 w-12">
				<circle cx="12" cy="12" r="10" />
			</svg>
		</mcms-empty-state>
	`,
})
class _TestHostMinimalComponent {}

describe('EmptyState', () => {
	let fixture: ComponentFixture<EmptyState>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [EmptyState],
		}).compileComponents();

		fixture = TestBed.createComponent(EmptyState);
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

	it('should be centered', () => {
		expect(fixture.nativeElement.classList.contains('items-center')).toBe(true);
		expect(fixture.nativeElement.classList.contains('justify-center')).toBe(true);
		expect(fixture.nativeElement.classList.contains('text-center')).toBe(true);
	});

	it('should have default size of md with p-8 padding', () => {
		expect(fixture.componentInstance.size()).toBe('md');
		expect(fixture.nativeElement.classList.contains('p-8')).toBe(true);
	});

	it('should apply sm size classes', () => {
		fixture.componentRef.setInput('size', 'sm');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('p-6')).toBe(true);
	});

	it('should apply lg size classes', () => {
		fixture.componentRef.setInput('size', 'lg');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('p-12')).toBe(true);
	});
});

describe('EmptyState Integration', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render title', () => {
		const title = fixture.nativeElement.querySelector('h3');
		expect(title).toBeTruthy();
		expect(title.textContent).toContain('No results found');
	});

	it('should render description', () => {
		const description = fixture.nativeElement.querySelector('p');
		expect(description).toBeTruthy();
		expect(description.textContent).toContain('Try adjusting your search criteria');
	});

	it('should render icon slot', () => {
		const icon = fixture.nativeElement.querySelector('[mcms-empty-state-icon]');
		expect(icon).toBeTruthy();
	});

	it('should render action slot', () => {
		const action = fixture.nativeElement.querySelector('[mcms-empty-state-action]');
		expect(action).toBeTruthy();
		expect(action.textContent).toContain('Create New');
	});

	it('should apply title size classes for md', () => {
		const title = fixture.nativeElement.querySelector('h3');
		expect(title.classList.contains('text-lg')).toBe(true);
	});

	it('should apply description size classes for md', () => {
		const description = fixture.nativeElement.querySelector('p');
		expect(description.classList.contains('text-sm')).toBe(true);
		expect(description.classList.contains('max-w-md')).toBe(true);
	});
});

describe('EmptyState Minimal', () => {
	let fixture: ComponentFixture<_TestHostMinimalComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostMinimalComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostMinimalComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render without title and description', () => {
		const emptyState = fixture.nativeElement.querySelector('mcms-empty-state');
		expect(emptyState).toBeTruthy();

		const title = fixture.nativeElement.querySelector('h3');
		const description = fixture.nativeElement.querySelector('p');
		expect(title).toBeNull();
		expect(description).toBeNull();
	});

	it('should still render icon', () => {
		const icon = fixture.nativeElement.querySelector('[mcms-empty-state-icon]');
		expect(icon).toBeTruthy();
	});
});

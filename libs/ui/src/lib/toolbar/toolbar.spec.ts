import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Toolbar } from './toolbar.component';
import { ToolbarWidget } from './toolbar-widget.component';
import { ToolbarWidgetGroup } from './toolbar-widget-group.component';
import { ToolbarSeparator } from './toolbar-separator.component';

@Component({
	imports: [Toolbar, ToolbarWidget, ToolbarWidgetGroup, ToolbarSeparator],
	template: `
		<mcms-toolbar [orientation]="orientation">
			<button mcms-toolbar-widget value="bold">Bold</button>
			<button mcms-toolbar-widget value="italic">Italic</button>
			<mcms-toolbar-separator />
			<mcms-toolbar-widget-group>
				<button mcms-toolbar-widget value="left">Left</button>
				<button mcms-toolbar-widget value="center">Center</button>
				<button mcms-toolbar-widget value="right">Right</button>
			</mcms-toolbar-widget-group>
		</mcms-toolbar>
	`,
})
class _TestHostComponent {
	orientation: 'horizontal' | 'vertical' = 'horizontal';
}

describe('Toolbar', () => {
	let fixture: ComponentFixture<Toolbar>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Toolbar],
		}).compileComponents();

		fixture = TestBed.createComponent(Toolbar);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="toolbar"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('toolbar');
	});

	it('should have horizontal orientation by default', () => {
		expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');
	});

	it('should have inline-flex layout', () => {
		expect(fixture.nativeElement.classList.contains('inline-flex')).toBe(true);
	});

	it('should have flex-row for horizontal', () => {
		expect(fixture.nativeElement.classList.contains('flex-row')).toBe(true);
	});

	it('should apply vertical orientation', () => {
		fixture.componentRef.setInput('orientation', 'vertical');
		fixture.detectChanges();
		expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('vertical');
		expect(fixture.nativeElement.classList.contains('flex-col')).toBe(true);
	});
});

describe('ToolbarSeparator', () => {
	let fixture: ComponentFixture<ToolbarSeparator>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ToolbarSeparator],
		}).compileComponents();

		fixture = TestBed.createComponent(ToolbarSeparator);
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
});

describe('Toolbar Integration', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render toolbar structure', () => {
		const toolbar = fixture.nativeElement.querySelector('mcms-toolbar');
		expect(toolbar).toBeTruthy();
	});

	it('should render toolbar widgets', () => {
		const widgets = fixture.nativeElement.querySelectorAll('[mcms-toolbar-widget]');
		expect(widgets.length).toBe(5);
	});

	it('should render separator', () => {
		const separator = fixture.nativeElement.querySelector('mcms-toolbar-separator');
		expect(separator).toBeTruthy();
	});

	it('should render widget group', () => {
		const group = fixture.nativeElement.querySelector('mcms-toolbar-widget-group');
		expect(group).toBeTruthy();
		expect(group.getAttribute('role')).toBe('group');
	});
});

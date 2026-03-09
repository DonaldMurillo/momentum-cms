import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlToolbar } from './toolbar.component';
import { HdlToolbarWidget } from './toolbar-widget.component';

@Component({
	imports: [HdlToolbar, HdlToolbarWidget],
	template: `
		<hdl-toolbar>
			<button hdl-toolbar-widget value="bold">Bold</button>
			<button hdl-toolbar-widget value="italic">Italic</button>
		</hdl-toolbar>
	`,
})
class TestHost {}

describe('HdlToolbar', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();
	});

	it('should render toolbar widgets', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const widgets = fixture.nativeElement.querySelectorAll('button[hdl-toolbar-widget]');
		expect(widgets.length).toBe(2);
	});

	it('should render widget text content', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const widgets = fixture.nativeElement.querySelectorAll('button[hdl-toolbar-widget]');
		expect(widgets[0].textContent).toContain('Bold');
		expect(widgets[1].textContent).toContain('Italic');
	});

	it('should have role="toolbar" on the host', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const el = fixture.nativeElement.querySelector('hdl-toolbar');
		expect(el.getAttribute('role')).toBe('toolbar');
	});

	it('should reflect selection state when values change via the aria directive', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const toolbarDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-TOOLBAR',
		);
		const toolbarComp = toolbarDebug.componentInstance as HdlToolbar;
		const widgets: HTMLElement[] = Array.from(
			fixture.nativeElement.querySelectorAll('button[hdl-toolbar-widget]'),
		);

		toolbarComp.toolbar.values.set(['bold']);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(widgets[0].getAttribute('data-state')).toBe('selected');
		expect(widgets[1].getAttribute('data-state')).toBe('unselected');
	});

	it('should update selection state when values change to a different widget', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const toolbarDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-TOOLBAR',
		);
		const toolbarComp = toolbarDebug.componentInstance as HdlToolbar;
		const widgets: HTMLElement[] = Array.from(
			fixture.nativeElement.querySelectorAll('button[hdl-toolbar-widget]'),
		);

		toolbarComp.toolbar.values.set(['bold']);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(widgets[0].getAttribute('data-state')).toBe('selected');

		toolbarComp.toolbar.values.set(['italic']);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(widgets[1].getAttribute('data-state')).toBe('selected');
	});

	it('should expose styling contract attributes on the toolbar and widgets', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const toolbar = fixture.nativeElement.querySelector('hdl-toolbar');
		const widgets = fixture.nativeElement.querySelectorAll('button[hdl-toolbar-widget]');

		expect(toolbar.getAttribute('data-slot')).toBe('toolbar');
		expect(toolbar.getAttribute('data-orientation')).toBe('horizontal');
		expect(widgets[0].getAttribute('data-slot')).toBe('toolbar-widget');
		expect(widgets[0].getAttribute('data-state')).toBe('unselected');
	});

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-toolbar');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});

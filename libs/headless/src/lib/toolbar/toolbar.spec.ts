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

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-toolbar');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});

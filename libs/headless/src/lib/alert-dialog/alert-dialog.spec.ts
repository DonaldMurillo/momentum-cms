import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { HdlAlertDialog } from './alert-dialog.component';
import { HdlAlertDialogTitle } from './alert-dialog-title.component';
import { HdlAlertDialogDescription } from './alert-dialog-description.component';
import { HdlDialogService } from '../dialog/dialog.service';

@Component({
	imports: [HdlAlertDialog, HdlAlertDialogTitle, HdlAlertDialogDescription],
	template: `
		<hdl-alert-dialog>
			<hdl-alert-dialog-title>Delete post</hdl-alert-dialog-title>
			<hdl-alert-dialog-description>This action cannot be undone.</hdl-alert-dialog-description>
		</hdl-alert-dialog>
	`,
})
class TestHost {}

describe('HdlAlertDialog', () => {
	it('should expose alertdialog semantics and label wiring', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const dialog = fixture.nativeElement.querySelector('hdl-alert-dialog');
		const title = fixture.nativeElement.querySelector('hdl-alert-dialog-title');
		const description = fixture.nativeElement.querySelector('hdl-alert-dialog-description');

		expect(dialog.getAttribute('role')).toBe('alertdialog');
		expect(dialog.getAttribute('aria-labelledby')).toBe(title.getAttribute('id'));
		expect(dialog.getAttribute('aria-describedby')).toBe(description.getAttribute('id'));
	});

	it('should have aria-modal="true"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const dialog = fixture.nativeElement.querySelector('hdl-alert-dialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
	});
});

describe('HdlDialogService with alertdialog', () => {
	let service: HdlDialogService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OverlayModule, A11yModule, TestHost],
			providers: [HdlDialogService],
		}).compileComponents();

		service = TestBed.inject(HdlDialogService);
	});

	afterEach(() => {
		service.closeAll();
		document.querySelector('.cdk-overlay-container')?.replaceChildren();
	});

	it('should auto-disable close on Escape for role="alertdialog" components', () => {
		const ref = service.open(TestHost);
		const closed = vi.fn();
		ref.afterClosed.subscribe(() => closed());

		// Simulate Escape key on the overlay
		const pane = document.querySelector('.cdk-overlay-pane');
		expect(pane).toBeTruthy();

		const paneEl = pane as HTMLElement;
		paneEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		// Alert dialog should NOT close on Escape by default
		expect(closed).not.toHaveBeenCalled();
	});

	it('should auto-disable close on backdrop click for role="alertdialog" components', () => {
		const ref = service.open(TestHost);
		const closed = vi.fn();
		ref.afterClosed.subscribe(() => closed());

		// Simulate backdrop click
		const backdrop = document.querySelector('.cdk-overlay-backdrop') as HTMLElement;
		expect(backdrop).toBeTruthy();
		backdrop.click();

		// Alert dialog should NOT close on backdrop click
		expect(closed).not.toHaveBeenCalled();
	});

	it('should still allow explicit disableClose=false override for alertdialog', () => {
		const ref = service.open(TestHost, { disableClose: false });
		const closed = vi.fn();
		ref.afterClosed.subscribe(() => closed());

		const overridePane = document.querySelector('.cdk-overlay-pane') as HTMLElement;
		overridePane.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(closed).toHaveBeenCalled();
	});
});

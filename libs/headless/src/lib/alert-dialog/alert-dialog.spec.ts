import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HdlAlertDialog } from './alert-dialog.component';
import { HdlAlertDialogTitle } from './alert-dialog-title.component';
import { HdlAlertDialogDescription } from './alert-dialog-description.component';

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
});

import { Directive, inject, input } from '@angular/core';
import { HdlDialogRef } from '../dialog/dialog-ref';

@Directive({
	selector: '[hdlAlertDialogCancel]',
	host: {
		'[attr.data-slot]': '"alert-dialog-cancel"',
		'(click)': 'close()',
	},
})
export class HdlAlertDialogCancel<R = unknown> {
	private readonly dialogRef = inject(HdlDialogRef<R>, { optional: true });
	readonly result = input<R | undefined>(undefined);

	close(): void {
		this.dialogRef?.close(this.result());
	}
}

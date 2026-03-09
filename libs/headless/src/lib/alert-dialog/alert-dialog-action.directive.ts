import { Directive, inject, input } from '@angular/core';
import { HdlDialogRef } from '../dialog/dialog-ref';

@Directive({
	selector: '[hdlAlertDialogAction]',
	host: {
		'[attr.data-slot]': '"alert-dialog-action"',
		'(click)': 'close()',
	},
})
export class HdlAlertDialogAction<R = unknown> {
	private readonly dialogRef = inject(HdlDialogRef<R>, { optional: true });
	readonly result = input<R | undefined>(undefined);

	close(): void {
		this.dialogRef?.close(this.result());
	}
}

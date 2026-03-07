import { Directive, inject, input } from '@angular/core';
import { HdlDialogRef } from './dialog-ref';

@Directive({
	selector: '[hdlDialogClose]',
	host: {
		'(click)': 'onClose()',
		'(keydown.enter)': 'onClose()',
		'(keydown.space)': 'onClose(); $event.preventDefault()',
	},
})
export class HdlDialogClose {
	private readonly dialogRef = inject(HdlDialogRef);
	readonly hdlDialogClose = input<unknown>(undefined);

	onClose(): void {
		this.dialogRef.close(this.hdlDialogClose());
	}
}

import { Directive, inject, input } from '@angular/core';
import { DialogRef } from './dialog-ref';

/**
 * Directive to close a dialog when clicked.
 *
 * Usage:
 * ```html
 * <button mcmsDialogClose>Cancel</button>
 * <button [mcmsDialogClose]="'confirmed'">Confirm</button>
 * ```
 */
@Directive({
	selector: '[mcmsDialogClose]',
	host: {
		'(click)': 'onClick()',
	},
})
export class DialogClose<R = unknown> {
	/** Result to pass when closing the dialog. */
	readonly mcmsDialogClose = input<R | undefined>(undefined);

	private readonly dialogRef = inject(DialogRef<R>, { optional: true });

	onClick(): void {
		this.dialogRef?.close(this.mcmsDialogClose());
	}
}

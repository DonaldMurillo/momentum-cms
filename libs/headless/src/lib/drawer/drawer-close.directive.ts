import { Directive, inject, input } from '@angular/core';
import { HdlDialogRef } from '../dialog/dialog-ref';

@Directive({
	selector: '[hdlDrawerClose]',
	host: {
		'[attr.data-slot]': '"drawer-close"',
		'(click)': 'close()',
	},
})
export class HdlDrawerClose<R = unknown> {
	private readonly drawerRef = inject(HdlDialogRef<R>, { optional: true });
	readonly result = input<R | undefined>(undefined);

	close(): void {
		this.drawerRef?.close(this.result());
	}
}

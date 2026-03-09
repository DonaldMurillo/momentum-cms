import { Directive, inject } from '@angular/core';
import { HdlChip } from './chip.component';

@Directive({
	selector: 'button[hdlChipRemove]',
	host: {
		'[attr.data-slot]': '"chip-remove"',
		'[attr.type]': '"button"',
		'(click)': 'remove()',
	},
})
export class HdlChipRemove {
	private readonly chip = inject(HdlChip);

	remove(): void {
		this.chip.remove();
	}
}

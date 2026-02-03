import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Dialog content component.
 */
@Component({
	selector: 'mcms-dialog-content',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			padding: 1.5rem;
			overflow-y: auto;
			flex: 1;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogContent {}

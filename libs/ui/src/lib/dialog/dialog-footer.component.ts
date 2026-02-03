import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Dialog footer component.
 */
@Component({
	selector: 'mcms-dialog-footer',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: flex;
			flex-direction: row;
			justify-content: flex-end;
			gap: 0.5rem;
			padding: 1.5rem;
			padding-top: 0;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogFooter {}

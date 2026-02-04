import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Dialog header component.
 */
@Component({
	selector: 'mcms-dialog-header',
	host: { class: 'block' },
	template: `<ng-content />`,
	styles: `
		:host {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			padding: 1.5rem;
			padding-bottom: 0;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogHeader {}

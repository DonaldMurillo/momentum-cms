import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { Dialog } from './dialog.component';

let uniqueId = 0;

/**
 * Dialog title component.
 */
@Component({
	selector: 'mcms-dialog-title',
	host: {
		'[id]': 'id()',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			font-size: 1.125rem;
			font-weight: 600;
			line-height: 1.5;
			letter-spacing: -0.025em;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogTitle implements OnInit {
	readonly id = input(`mcms-dialog-title-${uniqueId++}`);

	private readonly dialog = inject(Dialog, { optional: true });

	ngOnInit(): void {
		this.dialog?.registerTitle(this.id());
	}
}

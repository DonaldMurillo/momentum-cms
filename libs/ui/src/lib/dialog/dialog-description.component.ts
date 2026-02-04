import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { Dialog } from './dialog.component';

let uniqueId = 0;

/**
 * Dialog description component.
 */
@Component({
	selector: 'mcms-dialog-description',
	host: {
		'[id]': 'id()',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			font-size: 0.875rem;
			color: hsl(var(--mcms-muted-foreground));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogDescription implements OnInit {
	readonly id = input(`mcms-dialog-desc-${uniqueId++}`);

	private readonly dialog = inject(Dialog, { optional: true });

	ngOnInit(): void {
		this.dialog?.registerDescription(this.id());
	}
}

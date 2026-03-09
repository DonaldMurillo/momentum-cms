import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';

@Component({
	selector: 'hdl-command-dialog-panel',
	hostDirectives: [CdkTrapFocus],
	host: {
		role: 'dialog',
		'[attr.aria-modal]': 'true',
		'[attr.aria-label]': 'label()',
		'[attr.data-slot]': '"command-dialog-panel"',
		'[attr.data-state]': 'state()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCommandDialogPanel {
	readonly label = input('Command palette');
	readonly state = input<'open' | 'closed'>('open');

	constructor() {
		inject(CdkTrapFocus).autoCapture = true;
	}
}

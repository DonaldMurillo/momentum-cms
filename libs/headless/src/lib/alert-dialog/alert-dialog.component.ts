import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';

@Component({
	selector: 'hdl-alert-dialog',
	hostDirectives: [CdkTrapFocus],
	host: {
		'[attr.data-slot]': '"alert-dialog"',
		'[attr.data-state]': '"open"',
		role: 'alertdialog',
		'[attr.aria-modal]': 'true',
		'[attr.aria-labelledby]': 'titleId()',
		'[attr.aria-describedby]': 'descriptionId()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlAlertDialog {
	readonly titleId = signal<string | null>(null);
	readonly descriptionId = signal<string | null>(null);

	constructor() {
		inject(CdkTrapFocus).autoCapture = true;
	}

	registerTitle(id: string): void {
		this.titleId.set(id);
	}

	unregisterTitle(id: string): void {
		if (this.titleId() === id) {
			this.titleId.set(null);
		}
	}

	registerDescription(id: string): void {
		this.descriptionId.set(id);
	}

	unregisterDescription(id: string): void {
		if (this.descriptionId() === id) {
			this.descriptionId.set(null);
		}
	}
}

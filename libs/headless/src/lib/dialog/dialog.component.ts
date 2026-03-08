import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
	selector: 'hdl-dialog',
	imports: [A11yModule],
	host: {
		'[attr.data-slot]': '"dialog"',
		'[attr.data-state]': '"open"',
		role: 'dialog',
		'[attr.aria-modal]': 'true',
		'[attr.aria-labelledby]': 'titleId()',
		'[attr.aria-describedby]': 'descriptionId()',
	},
	template: `
		<div cdkTrapFocus cdkTrapFocusAutoCapture>
			<ng-content />
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlDialog {
	readonly titleId = signal<string | null>(null);
	readonly descriptionId = signal<string | null>(null);

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

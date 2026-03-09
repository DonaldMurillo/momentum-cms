import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
	selector: 'hdl-drawer',
	imports: [A11yModule],
	host: {
		'[attr.data-slot]': '"drawer"',
		'[attr.data-state]': '"open"',
		'[attr.data-side]': 'side()',
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
export class HdlDrawer {
	readonly side = input<'left' | 'right' | 'top' | 'bottom'>('right');
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

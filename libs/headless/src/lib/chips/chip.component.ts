import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { HdlChips } from './chips.component';

@Component({
	selector: 'hdl-chip',
	host: {
		'[attr.data-slot]': '"chip"',
		'[attr.data-disabled]': 'resolvedDisabled() ? "true" : null',
		'[attr.data-removable]': 'removable() ? "true" : null',
		'[attr.tabindex]': 'resolvedDisabled() ? -1 : 0',
		role: 'listitem',
		'(keydown.backspace)': 'remove($event)',
		'(keydown.delete)': 'remove($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlChip {
	private readonly chips = inject(HdlChips);
	readonly value = input.required<string>();
	readonly disabled = input(false);
	readonly removable = input(true);
	readonly resolvedDisabled = computed(() => this.disabled() || this.chips.disabled());

	remove(event?: Event): void {
		if (this.resolvedDisabled() || !this.removable()) {
			return;
		}

		event?.preventDefault();
		this.chips.removeValue(this.value());
	}
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
	selector: 'hdl-progress',
	host: {
		'[attr.data-slot]': '"progress"',
		'[attr.data-state]': 'state()',
		role: 'progressbar',
		'[attr.aria-valuemin]': 'indeterminate() ? null : min()',
		'[attr.aria-valuemax]': 'indeterminate() ? null : max()',
		'[attr.aria-valuenow]': 'indeterminate() ? null : clampedValue()',
		'[attr.data-value]': 'indeterminate() ? null : clampedValue()',
		'[attr.data-min]': 'min()',
		'[attr.data-max]': 'max()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlProgress {
	readonly value = input(0);
	readonly min = input(0);
	readonly max = input(100);
	readonly indeterminate = input(false);

	readonly clampedValue = computed(() => {
		const min = this.min();
		const max = this.max();
		return Math.min(Math.max(this.value(), min), max);
	});

	readonly state = computed(() => {
		if (this.indeterminate()) return 'indeterminate';
		if (this.clampedValue() >= this.max()) return 'complete';
		return 'loading';
	});
}

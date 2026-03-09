import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { HdlSelect } from './select.component';

@Component({
	selector: 'hdl-select-value',
	host: {
		'[attr.data-slot]': '"select-value"',
		'[attr.data-placeholder]': 'select.selectedLabel() ? null : "true"',
	},
	template: `{{ select.selectedLabel() ?? placeholder() ?? '' }}`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSelectValue {
	protected readonly select = inject(HdlSelect);
	readonly placeholder = input<string | null>(null);
}

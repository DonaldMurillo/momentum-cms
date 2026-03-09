import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { HDL_FIELD_CONTEXT } from './field.token';

@Component({
	selector: 'hdl-label',
	host: {
		'[attr.data-slot]': '"label"',
		'[attr.for]': 'resolvedFor()',
		'[attr.data-required]': 'resolvedRequired() ? "true" : null',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlLabel {
	private readonly field = inject(HDL_FIELD_CONTEXT, { optional: true });
	readonly for = input<string | null>(null);
	readonly required = input(false);
	readonly resolvedFor = computed(
		() => this.for() ?? this.field?.controlId() ?? this.field?.defaultControlId() ?? null,
	);
	readonly resolvedRequired = computed(() => this.required() || this.field?.required() || false);
}

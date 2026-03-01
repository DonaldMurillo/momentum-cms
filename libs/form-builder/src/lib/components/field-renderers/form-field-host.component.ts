import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	signal,
	Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { FormFieldConfig } from '../../types/form-schema.types';
import { FormFieldRegistry } from '../../services/form-field-registry.service';

/**
 * Dynamic field host that resolves field renderer components from the registry.
 *
 * Uses `NgComponentOutlet` to render the appropriate field renderer component
 * based on the field type, resolved from `FormFieldRegistry`.
 */
@Component({
	selector: 'mcms-form-field-host',
	imports: [NgComponentOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (resolvedComponent()) {
			<ng-container
				[ngComponentOutlet]="resolvedComponent()"
				[ngComponentOutletInputs]="rendererInputs()"
			/>
		}
	`,
})
export class FormFieldHostComponent {
	private readonly registry = inject(FormFieldRegistry);

	readonly field = input.required<FormFieldConfig>();
	readonly formNode = input<unknown>(null);

	readonly resolvedComponent = signal<Type<unknown> | null>(null);

	readonly rendererInputs = computed(() => ({
		field: this.field(),
		formNode: this.formNode(),
	}));

	constructor() {
		effect(() => {
			const fieldType = this.field().type;
			const loader = this.registry.get(fieldType);
			if (loader) {
				loader()
					.then((component) => this.resolvedComponent.set(component))
					.catch(() => {
						// Silently fail — field won't render
					});
			}
		});
	}
}

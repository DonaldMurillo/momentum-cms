import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { HDL_FIELD_CONTEXT } from '../field/field.token';

let nextId = 0;

@Component({
	selector: 'textarea[hdl-textarea]',
	host: {
		'[attr.data-slot]': '"textarea"',
		'[attr.data-disabled]': 'resolvedDisabled() ? "true" : null',
		'[attr.data-invalid]': 'resolvedInvalid() ? "true" : null',
		'[attr.data-required]': 'resolvedRequired() ? "true" : null',
		'[id]': 'resolvedId()',
		'[disabled]': 'resolvedDisabled()',
		'[readOnly]': 'readonly()',
		'[required]': 'resolvedRequired()',
		'[attr.aria-invalid]': 'resolvedInvalid() ? "true" : null',
		'[attr.aria-describedby]': 'describedBy()',
		'[attr.aria-errormessage]': 'errorMessage()',
	},
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTextarea {
	readonly field = inject(HDL_FIELD_CONTEXT, { optional: true });
	private readonly generatedId = `hdl-textarea-${nextId++}`;
	readonly id = input<string | null>(null);
	readonly disabled = input(false);
	readonly invalid = input(false);
	readonly required = input(false);
	readonly readonly = input(false);
	readonly resolvedId = computed(
		() => this.id() ?? this.field?.defaultControlId() ?? this.generatedId,
	);
	readonly resolvedDisabled = computed(() => this.disabled() || this.field?.disabled() || false);
	readonly resolvedInvalid = computed(() => this.invalid() || this.field?.invalid() || false);
	readonly resolvedRequired = computed(() => this.required() || this.field?.required() || false);
	readonly describedBy = computed(() => this.field?.describedBy() ?? null);
	readonly errorMessage = computed(() => this.field?.errorId() ?? null);

	constructor() {
		effect((onCleanup) => {
			const id = this.resolvedId();
			untracked(() => {
				this.field?.registerControl(id);
			});
			onCleanup(() => {
				untracked(() => {
					this.field?.unregisterControl(id);
				});
			});
		});
	}
}

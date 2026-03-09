import {
	ChangeDetectionStrategy,
	Component,
	computed,
	forwardRef,
	input,
	signal,
} from '@angular/core';
import { HDL_FIELD_CONTEXT, type HdlFieldContext } from './field.token';

let nextId = 0;

@Component({
	selector: 'hdl-field',
	host: {
		'[attr.data-slot]': '"field"',
		'[attr.data-invalid]': 'invalid() ? "true" : null',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'[attr.data-required]': 'required() ? "true" : null',
	},
	template: `<ng-content />`,
	providers: [
		{
			provide: HDL_FIELD_CONTEXT,
			useExisting: forwardRef(() => HdlField),
		},
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlField implements HdlFieldContext {
	readonly id = input(`hdl-field-${nextId++}`);
	readonly invalid = input(false);
	readonly disabled = input(false);
	readonly required = input(false);
	readonly controlId = signal<string | null>(null);
	readonly errorId = signal<string | null>(null);
	private readonly descriptionIds = signal<string[]>([]);
	readonly describedBy = computed(() => {
		const errorId = this.errorId();
		const ids = [...this.descriptionIds(), ...(errorId ? [errorId] : [])];
		return ids.length > 0 ? ids.join(' ') : null;
	});

	defaultControlId(): string {
		return `${this.id()}-control`;
	}

	registerControl(id: string): void {
		this.controlId.set(id);
	}

	unregisterControl(id: string): void {
		if (this.controlId() === id) {
			this.controlId.set(null);
		}
	}

	registerDescription(id: string): void {
		if (!this.descriptionIds().includes(id)) {
			this.descriptionIds.set([...this.descriptionIds(), id]);
		}
	}

	unregisterDescription(id: string): void {
		this.descriptionIds.set(this.descriptionIds().filter((value) => value !== id));
	}

	registerError(id: string): void {
		this.errorId.set(id);
	}

	unregisterError(id: string): void {
		if (this.errorId() === id) {
			this.errorId.set(null);
		}
	}
}

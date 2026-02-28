import { Injectable, signal, computed, type Signal, type WritableSignal } from '@angular/core';
import type {
	FormFieldConfig,
	FormFieldType,
	FormSettings,
	FormSchema,
} from '../types/form-schema.types';

/**
 * Reactive state management for the form schema editor.
 *
 * Manages the field list and form settings using signals.
 * Each instance is scoped to its provider (one per FormSchemaFieldRendererComponent).
 */
@Injectable()
export class FormSchemaEditorStateService {
	// ─── Field state ──────────────────────────────────────
	private readonly _fields: WritableSignal<FormFieldConfig[]> = signal([]);
	readonly fields: Signal<FormFieldConfig[]> = this._fields.asReadonly();

	// ─── Settings state ───────────────────────────────────
	private readonly _settings: WritableSignal<FormSettings> = signal({});
	readonly settings: Signal<FormSettings> = this._settings.asReadonly();

	// ─── Schema metadata ──────────────────────────────────
	private readonly _schemaId: WritableSignal<string> = signal('');
	private readonly _title: WritableSignal<string> = signal('');
	private readonly _description: WritableSignal<string> = signal('');

	// ─── Computed ─────────────────────────────────────────
	readonly fieldCount: Signal<number> = computed(() => this._fields().length);

	/**
	 * Reconstruct the full FormSchema from editor state.
	 * Used to sync back to the form node value.
	 */
	readonly schema: Signal<FormSchema> = computed(() => ({
		id: this._schemaId(),
		title: this._title() || undefined,
		description: this._description() || undefined,
		fields: this._fields(),
		settings: this._settings(),
	}));

	// ─── Schema I/O ───────────────────────────────────────

	/** Load a FormSchema into editor state. */
	setSchema(schema: FormSchema | null | undefined): void {
		if (!schema) {
			this._fields.set([]);
			this._settings.set({});
			this._schemaId.set('');
			this._title.set('');
			this._description.set('');
			return;
		}
		this._fields.set(schema.fields ?? []);
		this._settings.set(schema.settings ?? {});
		this._schemaId.set(schema.id ?? '');
		this._title.set(schema.title ?? '');
		this._description.set(schema.description ?? '');
	}

	// ─── Field operations ─────────────────────────────────

	/** Add a new field of the given type at the end of the list. */
	addField(type: FormFieldType): FormFieldConfig {
		const name = generateFieldName(type, this._fields());
		const field: FormFieldConfig = {
			name,
			type,
			label: humanizeType(type),
		};
		this._fields.update((fields) => [...fields, field]);
		return field;
	}

	/** Remove a field at the given index. */
	removeField(index: number): void {
		this._fields.update((fields) => fields.filter((_, i) => i !== index));
	}

	/** Move a field from one index to another (for drag-drop reorder). */
	moveField(fromIndex: number, toIndex: number): void {
		this._fields.update((fields) => {
			if (fromIndex < 0 || fromIndex >= fields.length) return fields;
			if (toIndex < 0 || toIndex >= fields.length) return fields;
			const next = [...fields];
			const [moved] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, moved);
			return next;
		});
	}

	/** Update a field at the given index with new configuration. */
	updateField(index: number, config: FormFieldConfig): void {
		this._fields.update((fields) => {
			if (index < 0 || index >= fields.length) return fields;
			const next = [...fields];
			next[index] = config;
			return next;
		});
	}

	// ─── Settings operations ──────────────────────────────

	updateSettings(settings: Partial<FormSettings>): void {
		this._settings.update((current) => ({ ...current, ...settings }));
	}
}

/** Generate a unique field name based on type and existing fields. */
function generateFieldName(type: FormFieldType, existingFields: FormFieldConfig[]): string {
	const existingNames = new Set(existingFields.map((f) => f.name));
	let name: string = type;
	let counter = 1;
	while (existingNames.has(name)) {
		name = type + String(counter);
		counter++;
	}
	return name;
}

/** Convert a field type to a human-readable label. */
function humanizeType(type: FormFieldType): string {
	switch (type) {
		case 'textarea':
			return 'Text Area';
		case 'email':
			return 'Email Address';
		case 'checkbox':
			return 'Checkbox';
		case 'radio':
			return 'Radio Group';
		case 'hidden':
			return 'Hidden Field';
		default:
			return type.charAt(0).toUpperCase() + type.slice(1);
	}
}

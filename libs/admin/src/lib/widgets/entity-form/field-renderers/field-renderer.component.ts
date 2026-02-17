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
import type { Field } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { FieldRendererRegistry } from '../../../services/field-renderer-registry.service';

/**
 * Dynamic field renderer that resolves components lazily from the registry.
 *
 * Uses `NgComponentOutlet` to render the appropriate field renderer component
 * based on the field type, resolved from `FieldRendererRegistry`.
 * Falls back to the `text` renderer for unknown types.
 */
@Component({
	selector: 'mcms-field-renderer',
	imports: [NgComponentOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (resolvedComponent()) {
			<ng-container *ngComponentOutlet="resolvedComponent(); inputs: rendererInputs()" />
		} @else if (loadError()) {
			<div
				role="alert"
				class="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive"
			>
				Failed to load field renderer
			</div>
		} @else {
			<div
				role="status"
				aria-label="Loading field"
				class="h-10 animate-pulse rounded-md bg-muted"
			></div>
		}
	`,
})
export class FieldRenderer {
	private readonly registry = inject(FieldRendererRegistry);

	/** Field definition */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this field */
	readonly formNode = input<unknown>(null);

	/** Root signal forms FieldTree (for layout fields that look up child nodes) */
	readonly formTree = input<unknown>(null);

	/** Form model data (for condition evaluation and relationship filterOptions) */
	readonly formModel = input<Record<string, unknown>>({});

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (for nested fields) */
	readonly path = input.required<string>();

	/** Resolved component type, set after lazy loading completes */
	readonly resolvedComponent = signal<Type<unknown> | null>(null);

	/** Error from lazy loading failure */
	readonly loadError = signal<Error | null>(null);

	/** Registry key: 'blocks-visual' when blocks field has visual editor, otherwise field.type */
	readonly registryKey = computed(() => {
		const f = this.field();
		if (f.type === 'blocks' && f.admin?.editor === 'visual') {
			return 'blocks-visual';
		}
		return f.type;
	});

	/** Inputs to pass to the dynamically loaded component via NgComponentOutlet */
	readonly rendererInputs = computed(() => ({
		field: this.field(),
		formNode: this.formNode(),
		formTree: this.formTree(),
		formModel: this.formModel(),
		mode: this.mode(),
		path: this.path(),
	}));

	constructor() {
		effect(() => {
			const key = this.registryKey();
			const loader = this.registry.get(key) ?? this.registry.get('text');

			if (loader) {
				loader()
					.then((component) => this.resolvedComponent.set(component))
					.catch((error: unknown) => {
						this.loadError.set(error instanceof Error ? error : new Error(String(error)));
					});
			}
		});
	}
}

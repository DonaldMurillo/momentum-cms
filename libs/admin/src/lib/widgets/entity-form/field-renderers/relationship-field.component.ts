import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Subscription } from 'rxjs';
import { McmsFormField, Badge } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark, heroPlus, heroEye } from '@ng-icons/heroicons/outline';
import { EntitySheetService } from '../../../services/entity-sheet.service';
import { humanizeFieldName } from '@momentum-cms/core';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getFieldNodeState, isRecord, getTitleField } from '../entity-form.types';

/** Option for the relationship dropdown */
interface RelationshipOption {
	value: string;
	label: string;
}

/**
 * Relationship field renderer.
 *
 * Fetches related collection documents and renders a dropdown selector.
 * Supports single select (default) and multi-select (hasMany: true).
 * Multi-select shows selected items as badges with remove buttons.
 *
 * Uses Angular Signal Forms bridge pattern: reads/writes value via
 * a FieldTree node's FieldState rather than event-based I/O.
 */
@Component({
	selector: 'mcms-relationship-field-renderer',
	imports: [McmsFormField, Badge, NgIcon],
	providers: [provideIcons({ heroXMark, heroPlus, heroEye })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="touchedErrors()"
		>
			<span mcmsLabel>{{ label() }}</span>

			@if (isLoading()) {
				<p class="text-sm text-muted-foreground py-2">Loading options...</p>
			} @else if (isMulti()) {
				@if (selectedOptions().length > 0) {
					<div class="flex flex-wrap gap-1 mb-2">
						@for (opt of selectedOptions(); track opt.value) {
							<mcms-badge variant="secondary">
								{{ opt.label }}
								@if (!isDisabled()) {
									<button
										type="button"
										class="ml-1 hover:text-destructive"
										(click)="removeSelection(opt.value)"
										[attr.aria-label]="'Remove ' + opt.label"
									>
										<ng-icon name="heroXMark" size="12" aria-hidden="true" />
									</button>
								}
							</mcms-badge>
						}
					</div>
				}
				@if (!isDisabled()) {
					<select
						[id]="fieldId()"
						class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						(change)="onMultiSelect($event)"
						(blur)="onBlur()"
					>
						<option value="">Add {{ relatedLabel() }}...</option>
						@for (opt of availableOptions(); track opt.value) {
							<option [value]="opt.value">{{ opt.label }}</option>
						}
					</select>
				}
			} @else {
				<select
					[id]="fieldId()"
					[disabled]="isDisabled()"
					class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					(change)="onSingleSelect($event)"
					(blur)="onBlur()"
				>
					<option value="">Select {{ relatedLabel() }}...</option>
					@for (opt of allOptions(); track opt.value) {
						<option [value]="opt.value" [selected]="opt.value === singleValue()">
							{{ opt.label }}
						</option>
					}
				</select>
			}
		</mcms-form-field>

		@if (entitySheetService && !isDisabled()) {
			<div class="flex gap-2 mt-1.5">
				<button
					type="button"
					class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					(click)="onCreateRelated()"
					[attr.aria-label]="'Create new ' + relatedLabel()"
				>
					<ng-icon name="heroPlus" size="14" aria-hidden="true" />
					New
				</button>
				@if (hasSelection()) {
					<button
						type="button"
						class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
						(click)="onViewRelated()"
						[attr.aria-label]="'View ' + relatedLabel()"
					>
						<ng-icon name="heroEye" size="14" aria-hidden="true" />
						View
					</button>
				}
			</div>
		}
	`,
})
export class RelationshipFieldRenderer {
	private readonly http = inject(HttpClient);
	readonly entitySheetService = inject(EntitySheetService, { optional: true });

	/** Field definition (must be a RelationshipField) */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this field */
	readonly formNode = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Full form model data (used for filterOptions) */
	readonly formModel = input<Record<string, unknown>>({});

	/** Bridge: extract FieldState from formNode */
	private readonly nodeState = computed(() => getFieldNodeState(this.formNode()));

	/** Loaded options from related collection */
	readonly allOptions = signal<RelationshipOption[]>([]);

	/** Loading state */
	readonly isLoading = signal(false);

	/** Unique field ID */
	readonly fieldId = computed(() => `field-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

	/** Whether the field is required */
	readonly required = computed(() => this.field().required ?? false);

	/** Whether the field is disabled */
	readonly isDisabled = computed(
		() => this.mode() === 'view' || (this.field().admin?.readOnly ?? false),
	);

	/** Whether this is a hasMany relationship */
	readonly isMulti = computed((): boolean => {
		const f = this.field();
		return f.type === 'relationship' ? (f.hasMany ?? false) : false;
	});

	/** Related collection slug extracted from the lazy collection reference */
	readonly relatedSlug = computed((): string => {
		const f = this.field();
		if (f.type === 'relationship') {
			const config = f.collection();
			if (isRecord(config) && typeof config['slug'] === 'string') {
				return config['slug'];
			}
		}
		return '';
	});

	/** The field name used to display document titles */
	readonly titleField = computed((): string => {
		const f = this.field();
		if (f.type !== 'relationship') return 'id';

		const config = f.collection();
		if (!isRecord(config)) return 'id';

		return getTitleField(config);
	});

	/** Label for the related collection (singular) */
	readonly relatedLabel = computed((): string => {
		const f = this.field();
		if (f.type !== 'relationship') return 'item';

		const config = f.collection();
		if (!isRecord(config)) return 'item';

		const labels = config['labels'];
		if (isRecord(labels) && typeof labels['singular'] === 'string') {
			return labels['singular'];
		}
		if (typeof config['slug'] === 'string') {
			return config['slug'];
		}
		return 'item';
	});

	/** Current value for single-select mode */
	readonly singleValue = computed((): string => {
		const state = this.nodeState();
		if (!state) return '';
		const val = state.value();
		if (typeof val === 'string') return val;
		// Handle populated objects with an id
		if (isRecord(val) && typeof val['id'] === 'string') return val['id'];
		return '';
	});

	/** Current values for multi-select mode */
	readonly multiValues = computed((): string[] => {
		const state = this.nodeState();
		if (!state) return [];
		const val = state.value();
		if (!Array.isArray(val)) return [];
		return val
			.map((item: unknown) => {
				if (typeof item === 'string') return item;
				if (isRecord(item) && typeof item['id'] === 'string') return item['id'];
				return '';
			})
			.filter((v: string) => v !== '');
	});

	/** Selected options for multi-select display (resolved to labels) */
	readonly selectedOptions = computed((): RelationshipOption[] => {
		const values = this.multiValues();
		const options = this.allOptions();
		return values
			.map((v) => options.find((opt) => opt.value === v))
			.filter((opt): opt is RelationshipOption => opt !== undefined);
	});

	/** Available options for multi-select (excludes already selected) */
	readonly availableOptions = computed((): RelationshipOption[] => {
		const selected = new Set(this.multiValues());
		return this.allOptions().filter((opt) => !selected.has(opt.value));
	});

	/** Validation errors shown only when field is touched */
	readonly touchedErrors = computed((): readonly ValidationError[] => {
		const state = this.nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
	});

	constructor() {
		// Fetch related collection docs when the slug is resolved.
		// Uses onCleanup to cancel in-flight requests if the slug changes.
		effect((onCleanup) => {
			const slug = this.relatedSlug();
			if (slug) {
				const sub = this.fetchOptions(slug);
				onCleanup(() => sub.unsubscribe());
			}
		});
	}

	/** Handle single-select change */
	onSingleSelect(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLSelectElement) {
			const state = this.nodeState();
			if (state) {
				state.value.set(target.value || null);
			}
		}
	}

	/** Handle multi-select add */
	onMultiSelect(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) return;

		const selectedValue = target.value;
		if (!selectedValue) return;

		const state = this.nodeState();
		if (!state) return;

		const currentValues = this.multiValues();
		if (!currentValues.includes(selectedValue)) {
			state.value.set([...currentValues, selectedValue]);
		}
		// Reset dropdown to placeholder
		target.value = '';
	}

	/** Remove a value from multi-select */
	removeSelection(valueToRemove: string): void {
		const state = this.nodeState();
		if (!state) return;
		const currentValues = this.multiValues();
		state.value.set(currentValues.filter((v) => v !== valueToRemove));
	}

	/** Whether there is a current selection (for showing "View" button) */
	readonly hasSelection = computed(
		(): boolean => !!this.singleValue() || this.multiValues().length > 0,
	);

	/**
	 * Handle blur from select elements.
	 */
	onBlur(): void {
		const state = this.nodeState();
		if (state) state.markAsTouched();
	}

	/** Open the entity sheet to create a new related entity */
	onCreateRelated(): void {
		const slug = this.relatedSlug();
		if (!slug || !this.entitySheetService) return;

		this.entitySheetService.openCreate(slug).subscribe((result) => {
			if (result.action === 'created' && result.entity) {
				const state = this.nodeState();
				if (!state) return;

				const entityId = String(result.entity.id);
				if (this.isMulti()) {
					const current = this.multiValues();
					state.value.set([...current, entityId]);
				} else {
					state.value.set(entityId);
				}

				// Refresh options to include the newly created entity
				this.fetchOptions(slug);
			}
		});
	}

	/** Open the entity sheet to view the selected related entity */
	onViewRelated(): void {
		const slug = this.relatedSlug();
		if (!slug || !this.entitySheetService) return;

		const id = this.isMulti() ? this.multiValues()[0] : this.singleValue();
		if (!id) return;

		this.entitySheetService.openView(slug, id).subscribe((result) => {
			if (result.action === 'deleted') {
				const state = this.nodeState();
				if (!state) return;

				// Clear the deleted entity from the selection
				if (this.isMulti()) {
					const current = this.multiValues();
					state.value.set(current.filter((v) => v !== id));
				} else {
					state.value.set(null);
				}

				// Refresh options to remove the deleted entity
				this.fetchOptions(slug);
			}
		});
	}

	/** Fetch options from the related collection API, returns subscription for cleanup */
	fetchOptions(slug: string): Subscription {
		this.isLoading.set(true);
		const titleField = this.titleField();

		// Build query params, including filterOptions if defined
		const params: Record<string, string> = { limit: '100' };
		const f = this.field();
		if (f.type === 'relationship' && f.filterOptions) {
			const whereClause = f.filterOptions({ data: this.formModel() });
			for (const [key, val] of Object.entries(whereClause)) {
				if (val !== undefined && val !== null) {
					params[`where[${key}]`] = String(val);
				}
			}
		}

		return this.http
			.get<{ docs?: Array<Record<string, unknown>> }>(`/api/${slug}`, {
				params,
			})
			.subscribe({
				next: (response) => {
					const docs = response.docs ?? [];
					const options: RelationshipOption[] = docs.map((doc) => {
						const id = typeof doc['id'] === 'string' ? doc['id'] : String(doc['id'] ?? '');
						const titleValue = doc[titleField];
						const label = titleField !== 'id' && typeof titleValue === 'string' ? titleValue : id;
						return { value: id, label };
					});
					this.allOptions.set(options);
					this.isLoading.set(false);
				},
				error: (err: unknown) => {
					console.error(`Failed to load relationship options for "${slug}":`, err);
					this.allOptions.set([]);
					this.isLoading.set(false);
				},
			});
	}
}

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Subscription } from 'rxjs';
import { FormField, Badge } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';
import { isRecord } from '../entity-form.types';

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
 */
@Component({
	selector: 'mcms-relationship-field-renderer',
	imports: [FormField, Badge, NgIcon],
	providers: [provideIcons({ heroXMark })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<mcms-form-field
			[id]="fieldId()"
			[required]="required()"
			[disabled]="isDisabled()"
			[errors]="fieldErrors()"
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
	`,
})
export class RelationshipFieldRenderer {
	private readonly http = inject(HttpClient);

	/** Field definition (must be a RelationshipField) */
	readonly field = input.required<Field>();

	/** Current value (string ID for single, string[] for hasMany) */
	readonly value = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Field error */
	readonly error = input<string | undefined>(undefined);

	/** Field change event */
	readonly fieldChange = output<FieldChangeEvent>();

	/** Loaded options from related collection */
	readonly allOptions = signal<RelationshipOption[]>([]);

	/** Loading state */
	readonly isLoading = signal(false);

	/** Unique field ID */
	readonly fieldId = computed(() => `field-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || this.field().name);

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

		// Check admin.useAsTitle first
		const admin = config['admin'];
		if (isRecord(admin) && typeof admin['useAsTitle'] === 'string') {
			return admin['useAsTitle'];
		}

		// Fall back to first field named 'title' or 'name'
		const fields = config['fields'];
		if (Array.isArray(fields)) {
			for (const field of fields) {
				if (isRecord(field) && typeof field['name'] === 'string') {
					if (field['name'] === 'title' || field['name'] === 'name') {
						return field['name'];
					}
				}
			}
		}

		return 'id';
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
		const val = this.value();
		if (typeof val === 'string') return val;
		// Handle populated objects with an id
		if (isRecord(val) && typeof val['id'] === 'string') return val['id'];
		return '';
	});

	/** Current values for multi-select mode */
	readonly multiValues = computed((): string[] => {
		const val = this.value();
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

	/** Convert error string to ValidationError array */
	readonly fieldErrors = computed((): readonly ValidationError[] => {
		const err = this.error();
		if (!err) return [];
		return [{ kind: 'custom', message: err }];
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
			const selectedValue = target.value || null;
			this.fieldChange.emit({ path: this.path(), value: selectedValue });
		}
	}

	/** Handle multi-select add */
	onMultiSelect(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) return;

		const selectedValue = target.value;
		if (!selectedValue) return;

		const currentValues = this.multiValues();
		if (!currentValues.includes(selectedValue)) {
			this.fieldChange.emit({
				path: this.path(),
				value: [...currentValues, selectedValue],
			});
		}
		// Reset dropdown to placeholder
		target.value = '';
	}

	/** Remove a value from multi-select */
	removeSelection(valueToRemove: string): void {
		const currentValues = this.multiValues();
		this.fieldChange.emit({
			path: this.path(),
			value: currentValues.filter((v) => v !== valueToRemove),
		});
	}

	/** Fetch options from the related collection API, returns subscription for cleanup */
	private fetchOptions(slug: string): Subscription {
		this.isLoading.set(true);
		const titleField = this.titleField();

		return this.http
			.get<{ docs?: Array<Record<string, unknown>> }>(`/api/${slug}`, {
				params: { limit: '100' },
			})
			.subscribe({
				next: (response) => {
					const docs = response.docs ?? [];
					const options: RelationshipOption[] = docs.map((doc) => {
						const id =
							typeof doc['id'] === 'string' ? doc['id'] : String(doc['id'] ?? '');
						const titleValue = doc[titleField];
						const label =
							titleField !== 'id' && typeof titleValue === 'string'
								? titleValue
								: id;
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

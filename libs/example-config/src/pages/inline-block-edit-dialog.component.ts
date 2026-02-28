/**
 * Inline Block Edit Dialog
 *
 * Opens on live pages when an authenticated admin clicks "Edit Block".
 * Renders form fields for the block's editable fields (text, textarea,
 * select, checkbox, relationship), saves via the Momentum API, and
 * returns the updated blocks array.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type {
	BlockConfig,
	Field,
	SelectField,
	RelationshipField,
	CollectionConfig,
} from '@momentumcms/core';
import { injectMomentumAPI, type FindResult } from '@momentumcms/admin';
import {
	Button,
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogRef,
	DIALOG_DATA,
	Input,
	Textarea,
	Select,
	Checkbox,
	McmsFormField,
} from '@momentumcms/ui';
import type { SelectOption } from '@momentumcms/ui';

/** Data passed to the dialog via DIALOG_DATA. */
export interface InlineBlockEditData {
	blockConfig: BlockConfig;
	pageId: string;
	allBlocks: Record<string, unknown>[];
	blockIndex: number;
}

/** Supported field types for inline editing. */
const EDITABLE_FIELD_TYPES = new Set([
	'text',
	'textarea',
	'email',
	'slug',
	'select',
	'checkbox',
	'relationship',
]);

@Component({
	selector: 'app-inline-block-edit-dialog',
	imports: [
		Button,
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		Input,
		Textarea,
		Select,
		Checkbox,
		McmsFormField,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { style: 'display: block; width: 100%' },
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>Edit {{ blockLabel }}</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<div class="space-y-4 max-h-[60vh] overflow-y-auto p-1">
					@for (field of visibleFields; track field.name) {
						<mcms-form-field [id]="field.name" [required]="!!field.required">
							<span mcmsLabel>{{ field.label || field.name }}</span>
							@switch (field.type) {
								@case ('textarea') {
									<mcms-textarea
										[id]="field.name"
										[value]="getFieldValue(field.name)"
										(valueChange)="setFieldValue(field.name, $event)"
										[placeholder]="field.admin?.placeholder ?? ''"
									/>
								}
								@case ('select') {
									<mcms-select
										[id]="field.name"
										[value]="getFieldValue(field.name)"
										(valueChange)="setFieldValue(field.name, $event)"
										[options]="getSelectOptions(field)"
										[placeholder]="'Select...'"
									/>
								}
								@case ('relationship') {
									<mcms-select
										[id]="field.name"
										[value]="getFieldValue(field.name)"
										(valueChange)="setFieldValue(field.name, $event)"
										[options]="getRelationshipOptions(field.name)"
										[placeholder]="relationshipLoading(field.name) ? 'Loading...' : 'Select...'"
									/>
								}
								@case ('checkbox') {
									<mcms-checkbox
										[id]="field.name"
										[value]="getCheckboxValue(field.name)"
										(valueChange)="setCheckboxValue(field.name, $event)"
									>
										{{ field.label || field.name }}
									</mcms-checkbox>
								}
								@default {
									<mcms-input
										[id]="field.name"
										[value]="getFieldValue(field.name)"
										(valueChange)="setFieldValue(field.name, $event)"
										[placeholder]="field.admin?.placeholder ?? ''"
									/>
								}
							}
						</mcms-form-field>
					}
				</div>

				@if (visibleFields.length === 0) {
					<p class="text-sm text-muted-foreground py-4">
						This block has no inline-editable fields. Use the admin panel to edit it.
					</p>
				}

				@if (errorMessage()) {
					<p class="text-sm text-destructive mt-2">{{ errorMessage() }}</p>
				}
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button mcms-button variant="outline" type="button" (click)="onCancel()">Cancel</button>
				<button mcms-button type="button" (click)="onSave()" [disabled]="saving()">
					@if (saving()) {
						Saving...
					} @else {
						Save
					}
				</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class InlineBlockEditDialog {
	private readonly data = inject<InlineBlockEditData>(DIALOG_DATA);
	private readonly dialogRef = inject(DialogRef);
	private readonly api = injectMomentumAPI();

	readonly saving = signal(false);
	readonly errorMessage = signal('');

	private readonly blockData = this.data.allBlocks[this.data.blockIndex];

	readonly blockLabel = this.data.blockConfig.labels?.singular || this.data.blockConfig.slug;

	/** Only show fields that are editable and not hidden. */
	readonly visibleFields: Field[] = this.data.blockConfig.fields.filter(
		(f) => !f.admin?.hidden && EDITABLE_FIELD_TYPES.has(f.type),
	);

	/** Single signal holding all edited field values. */
	private readonly editedValues = signal<Record<string, unknown>>(
		Object.fromEntries(
			this.visibleFields.map((f) => [
				f.name,
				f.type === 'checkbox'
					? !!this.blockData[f.name]
					: this.blockData[f.name] == null
						? ''
						: String(this.blockData[f.name]),
			]),
		),
	);

	/** Relationship options loaded from API, keyed by field name. */
	private readonly relationshipOptionsMap = signal<Record<string, SelectOption[]>>({});
	private readonly relationshipLoadingMap = signal<Record<string, boolean>>({});

	constructor() {
		for (const field of this.visibleFields) {
			if (field.type === 'relationship') {
				this.loadRelationshipOptions(field);
			}
		}
	}

	getFieldValue(fieldName: string): string {
		const val = this.editedValues()[fieldName];
		return val == null ? '' : String(val);
	}

	setFieldValue(fieldName: string, value: string): void {
		this.editedValues.update((vals) => ({ ...vals, [fieldName]: value }));
	}

	getCheckboxValue(fieldName: string): boolean {
		return !!this.editedValues()[fieldName];
	}

	setCheckboxValue(fieldName: string, value: boolean): void {
		this.editedValues.update((vals) => ({ ...vals, [fieldName]: value }));
	}

	getSelectOptions(field: Field): SelectOption[] {
		if (field.type !== 'select') return [];
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by type check
		const selectField = field as SelectField;
		return selectField.options.map((o) => ({
			label: o.label,
			value: String(o.value),
		}));
	}

	getRelationshipOptions(fieldName: string): SelectOption[] {
		return this.relationshipOptionsMap()[fieldName] ?? [];
	}

	relationshipLoading(fieldName: string): boolean {
		return this.relationshipLoadingMap()[fieldName] ?? false;
	}

	onCancel(): void {
		this.dialogRef.close();
	}

	async onSave(): Promise<void> {
		this.saving.set(true);
		this.errorMessage.set('');

		try {
			// Build the updated block by merging changes into the original
			const updatedBlock: Record<string, unknown> = {
				...this.blockData,
				...this.editedValues(),
			};

			// Clone all blocks and replace the edited one
			const newBlocks = [...this.data.allBlocks];
			newBlocks[this.data.blockIndex] = updatedBlock;

			// Save via API
			await this.api.collection('pages').update(this.data.pageId, {
				content: newBlocks,
			});

			this.dialogRef.close(true);
		} catch {
			this.errorMessage.set('Failed to save changes. Please try again.');
			this.saving.set(false);
		}
	}

	/** Load relationship options from the related collection's API. */
	private loadRelationshipOptions(field: Field): void {
		if (field.type !== 'relationship') return;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by type check
		const relField = field as RelationshipField;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- collection() returns CollectionConfig
		const collection = relField.collection() as CollectionConfig;
		const slug = collection?.slug;
		if (!slug) return;

		this.relationshipLoadingMap.update((m) => ({ ...m, [field.name]: true }));

		// Build filter params from filterOptions if available
		const filterParams = relField.filterOptions?.({ data: this.blockData }) ?? {};

		this.api
			.collection(slug)
			.find({ limit: 100, ...filterParams })
			.then((result: FindResult<Record<string, unknown>>) => {
				const options: SelectOption[] = result.docs.map((doc) => ({
					value: String(doc['id']),
					label: String(doc['title'] ?? doc['name'] ?? doc['label'] ?? doc['id']),
				}));
				this.relationshipOptionsMap.update((m) => ({ ...m, [field.name]: options }));
				this.relationshipLoadingMap.update((m) => ({ ...m, [field.name]: false }));
			})
			.catch(() => {
				this.relationshipLoadingMap.update((m) => ({ ...m, [field.name]: false }));
			});
	}
}

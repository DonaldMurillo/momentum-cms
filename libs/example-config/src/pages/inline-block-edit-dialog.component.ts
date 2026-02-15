/**
 * Inline Block Edit Dialog
 *
 * Opens on live pages when an authenticated admin clicks "Edit Block".
 * Renders simple form fields (Input/Textarea) for the block's editable fields,
 * saves via the Momentum API, and returns the updated blocks array.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { BlockConfig, Field } from '@momentum-cms/core';
import { injectMomentumAPI } from '@momentum-cms/admin';
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
	McmsFormField,
} from '@momentum-cms/ui';

/** Data passed to the dialog via DIALOG_DATA. */
export interface InlineBlockEditData {
	blockConfig: BlockConfig;
	pageId: string;
	allBlocks: Record<string, unknown>[];
	blockIndex: number;
}

/** Supported field types for inline editing. */
const EDITABLE_FIELD_TYPES = new Set(['text', 'textarea', 'email', 'slug']);

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
				<div class="space-y-4 max-h-[60vh] overflow-y-auto py-1">
					@for (field of visibleFields; track field.name) {
						<mcms-form-field [id]="field.name" [required]="!!field.required">
							<span mcmsLabel>{{ field.label || field.name }}</span>
							@if (field.type === 'textarea') {
								<mcms-textarea
									[id]="field.name"
									[value]="getFieldValue(field.name)"
									(valueChange)="setFieldValue(field.name, $event)"
									[placeholder]="field.admin?.placeholder ?? ''"
								/>
							} @else {
								<mcms-input
									[id]="field.name"
									[value]="getFieldValue(field.name)"
									(valueChange)="setFieldValue(field.name, $event)"
									[placeholder]="field.admin?.placeholder ?? ''"
								/>
							}
						</mcms-form-field>
					}
				</div>

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

	/** Only show fields that are editable (text-like) and not hidden. */
	readonly visibleFields: Field[] = this.data.blockConfig.fields.filter(
		(f) => !f.admin?.hidden && EDITABLE_FIELD_TYPES.has(f.type),
	);

	/** Single signal holding all edited field values. */
	private readonly editedValues = signal<Record<string, string>>(
		Object.fromEntries(
			this.visibleFields.map((f) => [
				f.name,
				this.blockData[f.name] == null ? '' : String(this.blockData[f.name]),
			]),
		),
	);

	getFieldValue(fieldName: string): string {
		return this.editedValues()[fieldName] ?? '';
	}

	setFieldValue(fieldName: string, value: string): void {
		this.editedValues.update((vals) => ({ ...vals, [fieldName]: value }));
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
}

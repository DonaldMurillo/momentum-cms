import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDropList, CdkDrag, CdkDragHandle, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus, heroTrash, heroBars2, heroPencilSquare } from '@ng-icons/heroicons/outline';
import {
	Button,
	Badge,
	Input,
	McmsFormField,
	DialogService,
	DropdownTrigger,
	DropdownMenu,
	DropdownMenuItem,
} from '@momentumcms/ui';
import type { FormFieldConfig, FormFieldType } from '../types/form-schema.types';
import { FormSchemaEditorStateService } from './form-schema-editor-state.service';
import { FormSchemaPreviewComponent } from './form-schema-preview.component';
import {
	FormFieldEditorDialogComponent,
	type FormFieldEditorData,
} from './form-field-editor-dialog.component';

/** Available field types for the "Add Field" dropdown. */
const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
	{ value: 'text', label: 'Text' },
	{ value: 'textarea', label: 'Text Area' },
	{ value: 'number', label: 'Number' },
	{ value: 'email', label: 'Email' },
	{ value: 'select', label: 'Select' },
	{ value: 'checkbox', label: 'Checkbox' },
	{ value: 'radio', label: 'Radio Group' },
	{ value: 'date', label: 'Date' },
	{ value: 'hidden', label: 'Hidden' },
];

/**
 * Main form schema editor panel.
 *
 * Split layout: left side has a draggable field list with card-based editing,
 * right side has a live preview of the form.
 */
@Component({
	selector: 'mcms-form-schema-editor',
	imports: [
		CdkDropList,
		CdkDrag,
		CdkDragHandle,
		NgIcon,
		Button,
		Badge,
		Input,
		McmsFormField,
		DropdownTrigger,
		DropdownMenu,
		DropdownMenuItem,
		FormSchemaPreviewComponent,
	],
	providers: [provideIcons({ heroPlus, heroTrash, heroBars2, heroPencilSquare })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="flex gap-6 p-4" data-testid="form-schema-editor">
			<!-- Left: Field List -->
			<div class="flex-1 min-w-0">
				<!-- Form Settings -->
				<div class="mb-4 space-y-3 pb-4 border-b border-border">
					<h3 class="text-sm font-medium text-foreground">Form Settings</h3>
					<div class="grid grid-cols-2 gap-3">
						<mcms-form-field id="formSettingsSubmitLabel">
							<span mcmsLabel>Submit Button Label</span>
							<mcms-input
								id="formSettingsSubmitLabel"
								[value]="editorState.settings().submitLabel ?? ''"
								(valueChange)="editorState.updateSettings({ submitLabel: $event || undefined })"
								placeholder="Submit"
							/>
						</mcms-form-field>
						<mcms-form-field id="formSettingsSuccessMessage">
							<span mcmsLabel>Success Message</span>
							<mcms-input
								id="formSettingsSuccessMessage"
								[value]="editorState.settings().successMessage ?? ''"
								(valueChange)="editorState.updateSettings({ successMessage: $event || undefined })"
								placeholder="Thank you for your submission!"
							/>
						</mcms-form-field>
					</div>
				</div>

				<!-- Field List Header -->
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-sm font-medium text-foreground">Fields</h3>
					<span class="text-xs text-muted-foreground">{{ editorState.fieldCount() }} fields</span>
				</div>

				<!-- Field Cards -->
				@if (editorState.fields().length === 0) {
					<div
						class="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-lg"
					>
						<p class="text-sm text-muted-foreground mb-3">
							No fields yet. Add your first field to get started.
						</p>
						<button
							mcms-button
							variant="outline"
							[mcmsDropdownTrigger]="addFieldMenu"
							data-testid="add-field-button"
						>
							<ng-icon name="heroPlus" size="16" aria-hidden="true" />
							Add Field
						</button>
					</div>
				} @else {
					<div
						cdkDropList
						(cdkDropListDropped)="onDrop($event)"
						class="space-y-2"
						role="list"
						aria-label="Form fields"
						data-testid="field-list"
					>
						@for (field of editorState.fields(); track field.name; let i = $index) {
							<div
								cdkDrag
								class="border rounded-lg px-3 py-2.5 bg-card flex gap-2 items-center cursor-pointer hover:border-primary/50 transition-colors"
								(click)="editField(i)"
								(keydown.enter)="editField(i)"
								(keydown.space)="editField(i); $event.preventDefault()"
								tabindex="0"
								role="listitem"
								data-testid="field-card"
								[attr.data-field-name]="field.name"
								[attr.data-field-type]="field.type"
							>
								<div
									cdkDragHandle
									class="cursor-grab text-muted-foreground hover:text-foreground shrink-0"
									role="button"
									tabindex="0"
									[attr.aria-label]="'Reorder ' + (field.label || field.name)"
									aria-roledescription="sortable"
									(click)="$event.stopPropagation()"
								>
									<ng-icon name="heroBars2" size="16" aria-hidden="true" />
								</div>

								<mcms-badge variant="outline" class="shrink-0 text-xs">
									{{ field.type }}
								</mcms-badge>

								<div class="flex-1 min-w-0">
									<span class="text-sm font-medium truncate block" data-testid="field-label">
										{{ field.label || field.name }}
									</span>
									@if (field.label && field.label !== field.name) {
										<span class="text-xs text-muted-foreground">{{ field.name }}</span>
									}
								</div>

								@if (field.required) {
									<span class="text-xs text-destructive shrink-0" aria-label="Required field"
										>*</span
									>
								}

								<button
									mcms-button
									variant="ghost"
									size="icon"
									class="shrink-0 h-7 w-7"
									(click)="editField(i); $event.stopPropagation()"
									[attr.aria-label]="'Edit ' + (field.label || field.name)"
									data-testid="edit-field-button"
								>
									<ng-icon name="heroPencilSquare" size="14" aria-hidden="true" />
								</button>

								<button
									mcms-button
									variant="ghost"
									size="icon"
									class="shrink-0 h-7 w-7 text-destructive hover:text-destructive"
									(click)="removeField(i); $event.stopPropagation()"
									[attr.aria-label]="'Remove ' + (field.label || field.name)"
									data-testid="remove-field-button"
								>
									<ng-icon name="heroTrash" size="14" aria-hidden="true" />
								</button>
							</div>
						}
					</div>

					<!-- Add Field Button -->
					<div class="mt-3">
						<button
							mcms-button
							variant="outline"
							[mcmsDropdownTrigger]="addFieldMenu"
							data-testid="add-field-button"
						>
							<ng-icon name="heroPlus" size="16" aria-hidden="true" />
							Add Field
						</button>
					</div>
				}
			</div>

			<!-- Right: Live Preview -->
			<div class="flex-1 min-w-0" data-testid="form-preview-panel">
				<h3 class="text-sm font-medium text-foreground mb-3">Preview</h3>
				<div class="border border-border rounded-lg p-4 bg-background">
					<mcms-form-schema-preview />
				</div>
			</div>
		</div>

		<!-- Add Field Dropdown Menu (ng-template) -->
		<ng-template #addFieldMenu>
			<mcms-dropdown-menu>
				@for (type of fieldTypes; track type.value) {
					<button mcms-dropdown-item [value]="type.value" (selected)="addField(type.value)">
						{{ type.label }}
					</button>
				}
			</mcms-dropdown-menu>
		</ng-template>
	`,
})
export class FormSchemaEditorComponent {
	readonly editorState = inject(FormSchemaEditorStateService);
	private readonly dialogService = inject(DialogService);
	private readonly destroyRef = inject(DestroyRef);

	readonly fieldTypes = FIELD_TYPES;

	addField(type: FormFieldType): void {
		const newField = this.editorState.addField(type);
		// Open editor dialog for the newly added field
		const index = this.editorState.fields().length - 1;
		this.openFieldEditor(index, newField, true);
	}

	editField(index: number): void {
		const field = this.editorState.fields()[index];
		if (!field) return;
		this.openFieldEditor(index, field, false);
	}

	removeField(index: number): void {
		this.editorState.removeField(index);
	}

	onDrop(event: CdkDragDrop<unknown>): void {
		if (event.previousIndex === event.currentIndex) return;
		this.editorState.moveField(event.previousIndex, event.currentIndex);
	}

	private openFieldEditor(index: number, field: FormFieldConfig, isNew: boolean): void {
		const existingNames = this.editorState.fields().map((f) => f.name);

		const dialogRef = this.dialogService.open<
			FormFieldEditorDialogComponent,
			FormFieldEditorData,
			FormFieldConfig | undefined
		>(FormFieldEditorDialogComponent, {
			data: {
				field: { ...field },
				isNew,
				existingNames,
			},
			width: '32rem',
		});

		dialogRef.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
			if (result) {
				this.editorState.updateField(index, result);
			} else if (isNew) {
				// User cancelled adding a new field — remove the placeholder
				this.editorState.removeField(index);
			}
		});
	}
}

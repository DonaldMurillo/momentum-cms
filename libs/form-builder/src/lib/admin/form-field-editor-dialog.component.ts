import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
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
	DIALOG_DATA,
	DialogRef,
	Badge,
} from '@momentumcms/ui';
import type { SelectOption } from '@momentumcms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus, heroTrash } from '@ng-icons/heroicons/outline';
import type {
	FormFieldConfig,
	FormFieldOption,
	FormFieldType,
	FormFieldWidth,
} from '../types/form-schema.types';

/** Data passed to the dialog via DIALOG_DATA. */
export interface FormFieldEditorData {
	field: FormFieldConfig;
	/** Whether this is a new field (true) or editing an existing one (false). */
	isNew: boolean;
	/** Existing field names for uniqueness validation. */
	existingNames: string[];
}

/** All available field types. */
const FIELD_TYPE_OPTIONS: SelectOption[] = [
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

/** Width options. */
const WIDTH_OPTIONS: SelectOption[] = [
	{ value: 'full', label: 'Full Width' },
	{ value: 'half', label: 'Half Width' },
	{ value: 'third', label: 'One Third' },
];

/**
 * Dialog component for editing a single form field configuration.
 *
 * Opened via DialogService with FormFieldEditorData.
 * Returns the edited FormFieldConfig on save, or undefined on cancel.
 */
@Component({
	selector: 'mcms-form-field-editor-dialog',
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
		Badge,
		NgIcon,
	],
	providers: [provideIcons({ heroPlus, heroTrash })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { style: 'display: block; width: 100%' },
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>
					@if (isNew) {
						Add Field
					} @else {
						Edit Field
					}
					<mcms-badge variant="outline" class="ml-2">{{ fieldType() }}</mcms-badge>
				</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<div class="space-y-4 max-h-[60vh] overflow-y-auto p-1">
					<!-- Field Type (only for new fields) -->
					@if (isNew) {
						<mcms-form-field id="fieldType" [required]="true">
							<span mcmsLabel>Type</span>
							<mcms-select
								id="fieldType"
								[value]="fieldType()"
								(valueChange)="fieldType.set($event)"
								[options]="fieldTypeOptions"
								placeholder="Select type..."
							/>
						</mcms-form-field>
					}

					<!-- Name -->
					<mcms-form-field id="fieldName" [required]="true">
						<span mcmsLabel>Name</span>
						<mcms-input
							id="fieldName"
							[value]="fieldName()"
							(valueChange)="fieldName.set($event)"
							placeholder="e.g. firstName"
						/>
						@if (nameError()) {
							<span class="text-xs text-destructive">{{ nameError() }}</span>
						}
					</mcms-form-field>

					<!-- Label -->
					<mcms-form-field id="fieldLabel">
						<span mcmsLabel>Label</span>
						<mcms-input
							id="fieldLabel"
							[value]="fieldLabel()"
							(valueChange)="fieldLabel.set($event)"
							placeholder="Display label"
						/>
					</mcms-form-field>

					<!-- Placeholder -->
					@if (showPlaceholder()) {
						<mcms-form-field id="fieldPlaceholder">
							<span mcmsLabel>Placeholder</span>
							<mcms-input
								id="fieldPlaceholder"
								[value]="fieldPlaceholder()"
								(valueChange)="fieldPlaceholder.set($event)"
								placeholder="Placeholder text"
							/>
						</mcms-form-field>
					}

					<!-- Width -->
					<mcms-form-field id="fieldWidth">
						<span mcmsLabel>Width</span>
						<mcms-select
							id="fieldWidth"
							[value]="fieldWidth()"
							(valueChange)="fieldWidth.set($event)"
							[options]="widthOptions"
							placeholder="Select width..."
						/>
					</mcms-form-field>

					<!-- Required + Disabled -->
					<div class="flex gap-6">
						<mcms-checkbox
							id="fieldRequired"
							[value]="fieldRequired()"
							(valueChange)="fieldRequired.set($event)"
						>
							Required
						</mcms-checkbox>
						<mcms-checkbox
							id="fieldDisabled"
							[value]="fieldDisabled()"
							(valueChange)="fieldDisabled.set($event)"
						>
							Disabled
						</mcms-checkbox>
					</div>

					<!-- Text-specific: minLength, maxLength -->
					@if (showTextConstraints()) {
						<div class="grid grid-cols-2 gap-3">
							<mcms-form-field id="fieldMinLength">
								<span mcmsLabel>Min Length</span>
								<mcms-input
									id="fieldMinLength"
									type="number"
									[value]="fieldMinLength()"
									(valueChange)="fieldMinLength.set($event)"
								/>
							</mcms-form-field>
							<mcms-form-field id="fieldMaxLength">
								<span mcmsLabel>Max Length</span>
								<mcms-input
									id="fieldMaxLength"
									type="number"
									[value]="fieldMaxLength()"
									(valueChange)="fieldMaxLength.set($event)"
								/>
							</mcms-form-field>
						</div>
					}

					<!-- Textarea-specific: rows -->
					@if (fieldType() === 'textarea') {
						<mcms-form-field id="fieldRows">
							<span mcmsLabel>Rows</span>
							<mcms-input
								id="fieldRows"
								type="number"
								[value]="fieldRows()"
								(valueChange)="fieldRows.set($event)"
							/>
						</mcms-form-field>
					}

					<!-- Number-specific: min, max, step -->
					@if (fieldType() === 'number') {
						<div class="grid grid-cols-3 gap-3">
							<mcms-form-field id="fieldMin">
								<span mcmsLabel>Min</span>
								<mcms-input
									id="fieldMin"
									type="number"
									[value]="fieldMin()"
									(valueChange)="fieldMin.set($event)"
								/>
							</mcms-form-field>
							<mcms-form-field id="fieldMax">
								<span mcmsLabel>Max</span>
								<mcms-input
									id="fieldMax"
									type="number"
									[value]="fieldMax()"
									(valueChange)="fieldMax.set($event)"
								/>
							</mcms-form-field>
							<mcms-form-field id="fieldStep">
								<span mcmsLabel>Step</span>
								<mcms-input
									id="fieldStep"
									type="number"
									[value]="fieldStep()"
									(valueChange)="fieldStep.set($event)"
								/>
							</mcms-form-field>
						</div>
					}

					<!-- Validation pattern (text-like fields) -->
					@if (showPatternValidation()) {
						<mcms-form-field id="fieldPattern">
							<span mcmsLabel>Validation Pattern (Regex)</span>
							<mcms-input
								id="fieldPattern"
								[value]="fieldPattern()"
								(valueChange)="fieldPattern.set($event)"
								placeholder="e.g. ^[A-Za-z]+$"
							/>
						</mcms-form-field>
						<mcms-form-field id="fieldPatternMessage">
							<span mcmsLabel>Pattern Error Message</span>
							<mcms-input
								id="fieldPatternMessage"
								[value]="fieldPatternMessage()"
								(valueChange)="fieldPatternMessage.set($event)"
								placeholder="e.g. Only letters allowed"
							/>
						</mcms-form-field>
					}

					<!-- Options editor (select/radio) -->
					@if (showOptions()) {
						<div class="space-y-2">
							<span class="text-sm font-medium">Options</span>
							@for (option of fieldOptions(); track $index; let i = $index) {
								<div class="flex gap-2 items-center" data-testid="option-row">
									<mcms-input
										class="flex-1"
										[value]="option.label"
										(valueChange)="updateOption(i, { label: $event })"
										placeholder="Label"
									/>
									<mcms-input
										class="flex-1"
										[value]="'' + option.value"
										(valueChange)="updateOption(i, { value: $event })"
										placeholder="Value"
									/>
									<button
										mcms-button
										variant="ghost"
										size="icon"
										class="shrink-0 text-destructive hover:text-destructive"
										(click)="removeOption(i)"
										[attr.aria-label]="'Remove option ' + (i + 1)"
									>
										<ng-icon name="heroTrash" size="16" aria-hidden="true" />
									</button>
								</div>
							}
							<button mcms-button variant="outline" size="sm" (click)="addOption()">
								<ng-icon name="heroPlus" size="16" aria-hidden="true" />
								Add Option
							</button>
						</div>
					}
				</div>
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button mcms-button variant="outline" type="button" (click)="onCancel()">Cancel</button>
				<button mcms-button type="button" (click)="onSave()" [disabled]="!isValid()">
					@if (isNew) {
						Add Field
					} @else {
						Save Changes
					}
				</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class FormFieldEditorDialogComponent {
	private readonly data = inject<FormFieldEditorData>(DIALOG_DATA);
	private readonly dialogRef = inject(DialogRef);

	readonly isNew = this.data.isNew;
	private readonly originalName = this.data.field.name;
	private readonly otherNames = this.data.existingNames.filter((n) => n !== this.originalName);

	// ─── Field state signals ──────────────────────────────
	readonly fieldType = signal<string>(this.data.field.type);
	readonly fieldName = signal(this.data.field.name);
	readonly fieldLabel = signal(this.data.field.label ?? '');
	readonly fieldPlaceholder = signal(this.data.field.placeholder ?? '');
	readonly fieldWidth = signal<string>(this.data.field.width ?? 'full');
	readonly fieldRequired = signal(this.data.field.required ?? false);
	readonly fieldDisabled = signal(this.data.field.disabled ?? false);
	readonly fieldMinLength = signal(String(this.data.field.minLength ?? ''));
	readonly fieldMaxLength = signal(String(this.data.field.maxLength ?? ''));
	readonly fieldRows = signal(String(this.data.field.rows ?? ''));
	readonly fieldMin = signal(String(this.data.field.min ?? ''));
	readonly fieldMax = signal(String(this.data.field.max ?? ''));
	readonly fieldStep = signal(String(this.data.field.step ?? ''));
	readonly fieldPattern = signal(this.data.field.validation?.pattern ?? '');
	readonly fieldPatternMessage = signal(this.data.field.validation?.patternMessage ?? '');
	readonly fieldOptions = signal<FormFieldOption[]>(this.data.field.options ?? []);

	readonly fieldTypeOptions = FIELD_TYPE_OPTIONS;
	readonly widthOptions = WIDTH_OPTIONS;

	// ─── UI helpers ───────────────────────────────────────

	readonly showPlaceholder = computed((): boolean => {
		const t = this.fieldType();
		return t === 'text' || t === 'textarea' || t === 'email' || t === 'number';
	});

	readonly showTextConstraints = computed((): boolean => {
		const t = this.fieldType();
		return t === 'text' || t === 'textarea' || t === 'email';
	});

	readonly showPatternValidation = computed((): boolean => {
		const t = this.fieldType();
		return t === 'text' || t === 'email';
	});

	readonly showOptions = computed((): boolean => {
		const t = this.fieldType();
		return t === 'select' || t === 'radio';
	});

	readonly nameError = computed((): string => {
		const name = this.fieldName();
		if (!name.trim()) return 'Name is required';
		if (this.otherNames.includes(name)) return 'Name must be unique';
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return 'Name must be a valid identifier';
		return '';
	});

	readonly isValid = computed((): boolean => !this.nameError());

	// ─── Options operations ───────────────────────────────

	addOption(): void {
		this.fieldOptions.update((opts) => [...opts, { label: '', value: '' }]);
	}

	removeOption(index: number): void {
		this.fieldOptions.update((opts) => opts.filter((_, i) => i !== index));
	}

	updateOption(index: number, patch: Partial<FormFieldOption>): void {
		this.fieldOptions.update((opts) => {
			const next = [...opts];
			next[index] = { ...next[index], ...patch };
			return next;
		});
	}

	// ─── Actions ──────────────────────────────────────────

	onCancel(): void {
		this.dialogRef.close();
	}

	onSave(): void {
		if (!this.isValid()) return;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- signal stores string, validated by FIELD_TYPE_OPTIONS
		const type = this.fieldType() as FormFieldType;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- signal stores string, validated by WIDTH_OPTIONS
		const width = (this.fieldWidth() as FormFieldWidth) || undefined;
		const config: FormFieldConfig = {
			name: this.fieldName().trim(),
			type,
			label: this.fieldLabel() || undefined,
			placeholder: this.fieldPlaceholder() || undefined,
			required: this.fieldRequired() || undefined,
			disabled: this.fieldDisabled() || undefined,
			width,
		};

		// Text constraints
		if (this.showTextConstraints()) {
			const minLen = parseInt(this.fieldMinLength(), 10);
			const maxLen = parseInt(this.fieldMaxLength(), 10);
			if (!isNaN(minLen)) config.minLength = minLen;
			if (!isNaN(maxLen)) config.maxLength = maxLen;
		}

		// Textarea rows
		if (type === 'textarea') {
			const rows = parseInt(this.fieldRows(), 10);
			if (!isNaN(rows)) config.rows = rows;
		}

		// Number constraints
		if (type === 'number') {
			const min = parseFloat(this.fieldMin());
			const max = parseFloat(this.fieldMax());
			const step = parseFloat(this.fieldStep());
			if (!isNaN(min)) config.min = min;
			if (!isNaN(max)) config.max = max;
			if (!isNaN(step)) config.step = step;
		}

		// Pattern validation
		if (this.showPatternValidation() && this.fieldPattern()) {
			config.validation = {
				pattern: this.fieldPattern(),
				patternMessage: this.fieldPatternMessage() || undefined,
			};
		}

		// Options
		if (this.showOptions()) {
			config.options = this.fieldOptions().filter((o) => o.label || o.value);
		}

		this.dialogRef.close(config);
	}
}

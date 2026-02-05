import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { FormField, Button, Progress, DialogService } from '@momentum-cms/ui';
import type { ValidationError } from '@momentum-cms/ui';
import type { Field, UploadField } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';
import { UploadService, type UploadProgress } from '../../../services/upload.service';
import {
	MediaPreviewComponent,
	type MediaPreviewData,
} from '../../../widgets/media-preview/media-preview.component';
import { MediaPickerDialog, type MediaPickerResult } from './media-picker-dialog.component';
import { NgIcon } from '@ng-icons/core';
import { heroCloudArrowUp, heroXMark, heroPhoto } from '@ng-icons/heroicons/outline';

/**
 * Type guard for UploadField.
 */
function isUploadField(field: Field): field is UploadField {
	return field.type === 'upload';
}

/**
 * Check if object has a string property.
 * Note: Type assertion is required for accessing unknown object properties.
 */
function getStringProp(obj: unknown, key: string): string | undefined {
	if (typeof obj !== 'object' || obj === null) return undefined;
	if (!(key in obj)) return undefined;
	// Type guard requires accessing unknown object - eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const value = (obj as Record<string, unknown>)[key]; // eslint-disable-line @typescript-eslint/consistent-type-assertions
	return typeof value === 'string' ? value : undefined;
}

/**
 * Get HTMLInputElement safely from event.
 */
function getInputFromEvent(event: Event): HTMLInputElement | null {
	const target = event.target;
	if (target instanceof HTMLInputElement) {
		return target;
	}
	return null;
}

/**
 * Upload field renderer for file upload fields.
 * Supports drag & drop, file selection, and media library picking.
 */
@Component({
	selector: 'mcms-upload-field-renderer',
	imports: [FormField, Button, Progress, NgIcon, MediaPreviewComponent],
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

			@if (hasValue()) {
				<!-- Preview existing media -->
				<div class="flex items-start gap-4">
					<mcms-media-preview [media]="mediaPreviewData()" size="lg" />
					<div class="flex flex-col gap-2">
						<span class="text-sm text-mcms-muted-foreground">
							{{ mediaFilename() }}
						</span>
						@if (!isDisabled()) {
							<div class="flex gap-2">
								<button
									mcms-button
									variant="outline"
									size="sm"
									type="button"
									(click)="openMediaPicker()"
								>
									<ng-icon [name]="photoIcon" class="h-4 w-4" />
									Change
								</button>
								<button
									mcms-button
									variant="ghost"
									size="sm"
									type="button"
									(click)="removeMedia()"
								>
									<ng-icon [name]="xMarkIcon" class="h-4 w-4" />
									Remove
								</button>
							</div>
						}
					</div>
				</div>
			} @else if (isUploading()) {
				<!-- Upload in progress -->
				<div class="rounded-lg border border-mcms-border bg-mcms-muted/50 p-4">
					<div class="flex items-center gap-3">
						<mcms-media-preview [media]="uploadingFilePreview()" size="md" />
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{{ uploadingFilename() }}</p>
							<mcms-progress [value]="uploadProgress()" class="mt-2" />
							<p class="mt-1 text-xs text-mcms-muted-foreground">
								{{ uploadProgress() }}% uploaded
							</p>
						</div>
					</div>
				</div>
			} @else {
				<!-- Drop zone -->
				<div
					class="relative rounded-lg border-2 border-dashed transition-colors"
					[class.border-mcms-border]="!isDragging()"
					[class.border-mcms-primary]="isDragging()"
					[class.bg-mcms-primary/5]="isDragging()"
					[class.cursor-pointer]="!isDisabled()"
					[class.opacity-50]="isDisabled()"
					tabindex="0"
					role="button"
					[attr.aria-disabled]="isDisabled()"
					(dragover)="onDragOver($event)"
					(dragleave)="onDragLeave($event)"
					(drop)="onDrop($event)"
					(click)="triggerFileInput()"
					(keydown.enter)="triggerFileInput()"
					(keydown.space)="triggerFileInput()"
				>
					<div class="flex flex-col items-center justify-center gap-2 p-8">
						<ng-icon [name]="uploadIcon" class="h-10 w-10 text-mcms-muted-foreground" />
						<div class="text-center">
							<p class="text-sm font-medium">
								@if (isDragging()) {
									Drop file here
								} @else {
									Drag & drop or click to upload
								}
							</p>
							@if (mimeTypesHint()) {
								<p class="mt-1 text-xs text-mcms-muted-foreground">
									{{ mimeTypesHint() }}
								</p>
							}
							@if (maxSizeHint()) {
								<p class="text-xs text-mcms-muted-foreground">
									Max size: {{ maxSizeHint() }}
								</p>
							}
						</div>
						@if (!isDisabled()) {
							<div class="mt-2 flex gap-2">
								<button
									mcms-button
									variant="outline"
									size="sm"
									type="button"
									(click)="$event.stopPropagation(); openMediaPicker()"
								>
									<ng-icon [name]="photoIcon" class="h-4 w-4" />
									Select from library
								</button>
							</div>
						}
					</div>
					<input
						#fileInput
						type="file"
						class="sr-only"
						[accept]="acceptAttribute()"
						[disabled]="isDisabled()"
						(change)="onFileSelected($event)"
					/>
				</div>
			}

			@if (uploadError()) {
				<p class="mt-1 text-sm text-mcms-destructive">{{ uploadError() }}</p>
			}
		</mcms-form-field>
	`,
})
export class UploadFieldRenderer {
	private readonly uploadService = inject(UploadService);
	private readonly dialogService = inject(DialogService);

	/** Field definition */
	readonly field = input.required<Field>();

	/** Current value (media document ID or full document) */
	readonly value = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Field error */
	readonly error = input<string | undefined>(undefined);

	/** Field change event */
	readonly fieldChange = output<FieldChangeEvent>();

	/** Icon references */
	readonly uploadIcon = heroCloudArrowUp;
	readonly xMarkIcon = heroXMark;
	readonly photoIcon = heroPhoto;

	/** Internal state */
	readonly isDragging = signal(false);
	readonly uploadProgress = signal(0);
	readonly isUploading = signal(false);
	readonly uploadingFilename = signal('');
	readonly uploadError = signal<string | null>(null);
	readonly uploadingFile = signal<File | null>(null);

	/** Unique field ID */
	readonly fieldId = computed(() => `field-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || this.field().name);

	/** Whether the field is required */
	readonly required = computed(() => this.field().required ?? false);

	/** Whether the field is disabled */
	readonly isDisabled = computed(() => {
		return this.mode() === 'view' || (this.field().admin?.readOnly ?? false);
	});

	/** Get field as UploadField */
	readonly uploadField = computed((): UploadField => {
		const field = this.field();
		if (isUploadField(field)) {
			return field;
		}
		// Return a minimal UploadField if not the right type
		return { ...field, type: 'upload', relationTo: 'media' };
	});

	/** Whether we have a value */
	readonly hasValue = computed(() => {
		const val = this.value();
		return val !== null && val !== undefined && val !== '';
	});

	/** Media preview data from value */
	readonly mediaPreviewData = computed((): MediaPreviewData | null => {
		const val = this.value();
		if (!val) return null;

		// If value is a full document object
		if (typeof val === 'object' && val !== null) {
			return {
				url: getStringProp(val, 'url'),
				path: getStringProp(val, 'path'),
				mimeType: getStringProp(val, 'mimeType'),
				filename: getStringProp(val, 'filename'),
				alt: getStringProp(val, 'alt'),
			};
		}

		// If value is just an ID, we can't preview without fetching
		// Return a placeholder
		return {
			path: String(val),
		};
	});

	/** Media filename from value */
	readonly mediaFilename = computed(() => {
		const val = this.value();
		if (typeof val === 'object' && val !== null) {
			return getStringProp(val, 'filename') ?? 'Selected media';
		}
		return 'Selected media';
	});

	/** Preview data for file being uploaded */
	readonly uploadingFilePreview = computed((): MediaPreviewData | null => {
		const file = this.uploadingFile();
		if (!file) return null;

		return {
			mimeType: file.type,
			filename: file.name,
			url: URL.createObjectURL(file),
		};
	});

	/** MIME types hint for display */
	readonly mimeTypesHint = computed(() => {
		const mimeTypes = this.uploadField().mimeTypes;
		if (!mimeTypes || mimeTypes.length === 0) return null;

		const simplified = mimeTypes.map((type) => {
			if (type === 'image/*') return 'Images';
			if (type === 'video/*') return 'Videos';
			if (type === 'audio/*') return 'Audio';
			if (type === 'application/pdf') return 'PDF';
			return type;
		});

		return `Allowed: ${simplified.join(', ')}`;
	});

	/** Max size hint for display */
	readonly maxSizeHint = computed(() => {
		const maxSize = this.uploadField().maxSize;
		if (!maxSize) return null;

		if (maxSize >= 1024 * 1024 * 1024) {
			return `${(maxSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
		}
		if (maxSize >= 1024 * 1024) {
			return `${(maxSize / (1024 * 1024)).toFixed(1)} MB`;
		}
		if (maxSize >= 1024) {
			return `${(maxSize / 1024).toFixed(1)} KB`;
		}
		return `${maxSize} bytes`;
	});

	/** Accept attribute for file input */
	readonly acceptAttribute = computed(() => {
		const mimeTypes = this.uploadField().mimeTypes;
		if (!mimeTypes || mimeTypes.length === 0) return '*/*';
		return mimeTypes.join(',');
	});

	/** Convert error string to ValidationError array */
	readonly fieldErrors = computed((): readonly ValidationError[] => {
		const err = this.error();
		if (!err) return [];
		return [{ kind: 'custom', message: err }];
	});

	/**
	 * Handle drag over event.
	 */
	onDragOver(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		if (!this.isDisabled()) {
			this.isDragging.set(true);
		}
	}

	/**
	 * Handle drag leave event.
	 */
	onDragLeave(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.isDragging.set(false);
	}

	/**
	 * Handle file drop.
	 */
	onDrop(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.isDragging.set(false);

		if (this.isDisabled()) return;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			this.uploadFile(files[0]);
		}
	}

	/**
	 * Trigger hidden file input click.
	 */
	triggerFileInput(): void {
		if (this.isDisabled()) return;

		const input = document.querySelector(`#${this.fieldId()} input[type="file"]`);
		if (input instanceof HTMLInputElement) {
			input.click();
		}
	}

	/**
	 * Handle file selection from input.
	 */
	onFileSelected(event: Event): void {
		const input = getInputFromEvent(event);
		if (!input) return;
		const files = input.files;
		if (files && files.length > 0) {
			this.uploadFile(files[0]);
		}
		// Reset input so same file can be selected again
		input.value = '';
	}

	/**
	 * Upload a file.
	 */
	uploadFile(file: File): void {
		this.uploadError.set(null);

		// Validate file size
		const maxSize = this.uploadField().maxSize;
		if (maxSize && file.size > maxSize) {
			this.uploadError.set(`File size exceeds maximum of ${this.maxSizeHint()}`);
			return;
		}

		// Validate MIME type
		const mimeTypes = this.uploadField().mimeTypes;
		if (mimeTypes && mimeTypes.length > 0) {
			const isAllowed = mimeTypes.some((pattern) => {
				if (pattern.endsWith('/*')) {
					const prefix = pattern.slice(0, -1);
					return file.type.startsWith(prefix);
				}
				return file.type === pattern;
			});
			if (!isAllowed) {
				this.uploadError.set(`File type "${file.type}" is not allowed`);
				return;
			}
		}

		this.isUploading.set(true);
		this.uploadProgress.set(0);
		this.uploadingFilename.set(file.name);
		this.uploadingFile.set(file);

		this.uploadService.upload(file).subscribe({
			next: (progress: UploadProgress) => {
				this.uploadProgress.set(progress.progress);

				if (progress.status === 'complete' && progress.result) {
					this.isUploading.set(false);
					this.uploadingFile.set(null);
					// Emit the full document so we have all the data for preview
					this.fieldChange.emit({
						path: this.path(),
						value: progress.result,
					});
				} else if (progress.status === 'error') {
					this.isUploading.set(false);
					this.uploadingFile.set(null);
					this.uploadError.set(progress.error ?? 'Upload failed');
				}
			},
			error: (err: Error) => {
				this.isUploading.set(false);
				this.uploadingFile.set(null);
				this.uploadError.set(err.message ?? 'Upload failed');
			},
		});
	}

	/**
	 * Open media picker dialog to select existing media.
	 */
	openMediaPicker(): void {
		const dialogRef = this.dialogService.open<MediaPickerDialog, unknown, MediaPickerResult>(
			MediaPickerDialog,
			{
				width: '800px',
				maxWidth: '95vw',
				data: {
					mimeTypes: this.uploadField().mimeTypes,
					relationTo: this.uploadField().relationTo,
				},
			},
		);

		dialogRef.afterClosed.subscribe((result) => {
			if (result?.media) {
				this.fieldChange.emit({
					path: this.path(),
					value: result.media,
				});
			}
		});
	}

	/**
	 * Remove the current media value.
	 */
	removeMedia(): void {
		this.fieldChange.emit({
			path: this.path(),
			value: null,
		});
	}
}

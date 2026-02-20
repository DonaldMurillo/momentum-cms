import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { McmsFormField, Button, Progress, DialogService } from '@momentumcms/ui';
import type { ValidationError } from '@momentumcms/ui';
import { humanizeFieldName } from '@momentumcms/core';
import type { Field, UploadField } from '@momentumcms/core';
import type { EntityFormMode } from '../entity-form.types';
import { getFieldNodeState } from '../entity-form.types';
import { UploadService, type UploadProgress } from '../../../services/upload.service';
import { injectMomentumAPI } from '../../../services/momentum-api.service';
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
 *
 * Uses Angular Signal Forms bridge pattern: reads/writes value via
 * a FieldTree node's FieldState rather than event-based I/O.
 */
@Component({
	selector: 'mcms-upload-field-renderer',
	imports: [McmsFormField, Button, Progress, NgIcon, MediaPreviewComponent],
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
				<!-- Drop zone — keyboard-accessible for WCAG 2.1 SC 2.1.1 -->
				<div
					class="relative rounded-lg border-2 border-dashed transition-colors"
					[class.border-mcms-border]="!isDragging()"
					[class.border-mcms-primary]="isDragging()"
					[class.bg-mcms-primary/5]="isDragging()"
					[class.cursor-pointer]="!isDisabled()"
					[class.opacity-50]="isDisabled()"
					role="button"
					tabindex="0"
					[attr.aria-label]="'Upload file for ' + label()"
					[attr.aria-disabled]="isDisabled()"
					(dragover)="onDragOver($event)"
					(dragleave)="onDragLeave($event)"
					(drop)="onDrop($event)"
					(click)="triggerFileInput()"
					(keydown.enter)="triggerFileInput()"
					(keydown.space)="onDropZoneSpace($event)"
				>
					<div class="flex flex-col items-center justify-center gap-2 p-8">
						<ng-icon [name]="uploadIcon" class="h-10 w-10 text-mcms-muted-foreground" aria-hidden="true" />
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
					</div>
				</div>
				@if (!isDisabled()) {
					<div class="mt-2 flex gap-2">
						<button
							mcms-button
							variant="outline"
							size="sm"
							type="button"
							(click)="openMediaPicker()"
						>
							<ng-icon [name]="photoIcon" class="h-4 w-4" />
							Select from library
						</button>
					</div>
				}
				<input
					#fileInput
					type="file"
					class="sr-only"
					[accept]="acceptAttribute()"
					[disabled]="isDisabled()"
					(change)="onFileSelected($event)"
					[attr.aria-label]="'Choose file for ' + label()"
				/>
			}

			@if (uploadError()) {
				<p class="mt-1 text-sm text-mcms-destructive">{{ uploadError() }}</p>
			}
		</mcms-form-field>
	`,
})
export class UploadFieldRenderer {
	private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');
	private readonly uploadService = inject(UploadService);
	private readonly dialogService = inject(DialogService);
	private readonly api = injectMomentumAPI();

	/** Field definition */
	readonly field = input.required<Field>();

	/** Signal forms FieldTree node for this field */
	readonly formNode = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path */
	readonly path = input.required<string>();

	/** Bridge: extract FieldState from formNode */
	private readonly nodeState = computed(() => getFieldNodeState(this.formNode()));

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

	/** Resolved media document fetched from API when value is just an ID string */
	private readonly resolvedMedia = signal<Record<string, unknown> | null>(null);
	private resolvedMediaId: string | null = null;

	constructor() {
		// When the value is a string (media ID), fetch the full media document for preview
		effect(() => {
			const val = this.currentValue();
			if (typeof val === 'string' && val !== '') {
				// Avoid re-fetching the same ID
				const id = val;
				if (untracked(() => this.resolvedMediaId) === id) return;
				this.resolvedMediaId = id;
				const relationTo = untracked(() => this.uploadField().relationTo);
				this.api
					.collection(relationTo)
					.findById(id)
					.then((doc) => {
						if (doc) {
							this.resolvedMedia.set(doc);
						}
					})
					.catch(() => {
						// Silently fail — preview will show placeholder
					});
			} else if (typeof val === 'object' && val !== null) {
				// Already a full document, clear any stale resolved data
				this.resolvedMedia.set(null);
				this.resolvedMediaId = null;
			} else {
				this.resolvedMedia.set(null);
				this.resolvedMediaId = null;
			}
		});
	}

	/** Unique field ID */
	readonly fieldId = computed(() => `field-${this.path().replace(/\./g, '-')}`);

	/** Computed label */
	readonly label = computed(() => this.field().label || humanizeFieldName(this.field().name));

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

	/** Current value from FieldState */
	private readonly currentValue = computed(() => {
		const state = this.nodeState();
		return state ? state.value() : null;
	});

	/** Whether we have a value */
	readonly hasValue = computed(() => {
		const val = this.currentValue();
		return val !== null && val !== undefined && val !== '';
	});

	/** Effective media document — full object from value, or resolved from API */
	private readonly effectiveMedia = computed((): unknown => {
		const val = this.currentValue();
		if (typeof val === 'object' && val !== null) return val;
		// Value is a string ID — use resolved media if available
		return this.resolvedMedia();
	});

	/** Media preview data from value */
	readonly mediaPreviewData = computed((): MediaPreviewData | null => {
		const media = this.effectiveMedia();
		if (!media) return null;

		if (typeof media === 'object' && media !== null) {
			return {
				url: getStringProp(media, 'url'),
				path: getStringProp(media, 'path'),
				mimeType: getStringProp(media, 'mimeType'),
				filename: getStringProp(media, 'filename'),
				alt: getStringProp(media, 'alt'),
			};
		}

		return null;
	});

	/** Media filename from value */
	readonly mediaFilename = computed(() => {
		const media = this.effectiveMedia();
		if (typeof media === 'object' && media !== null) {
			return getStringProp(media, 'filename') ?? 'Selected media';
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

	/** Validation errors shown only when field is touched */
	readonly touchedErrors = computed((): readonly ValidationError[] => {
		const state = this.nodeState();
		if (!state || !state.touched()) return [];
		return state.errors().map((e) => ({ kind: e.kind, message: e.message }));
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

		const ref = this.fileInputRef();
		if (ref) {
			ref.nativeElement.click();
		}
	}

	/**
	 * Handle Space keydown on drop zone.
	 * Prevents default scroll behavior and triggers file input.
	 */
	onDropZoneSpace(event: Event): void {
		event.preventDefault();
		this.triggerFileInput();
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

		const relationTo = this.uploadField().relationTo;
		this.uploadService.uploadToCollection(relationTo, file).subscribe({
			next: (progress: UploadProgress) => {
				this.uploadProgress.set(progress.progress);

				if (progress.status === 'complete' && progress.result) {
					this.isUploading.set(false);
					this.uploadingFile.set(null);
					// Write the full document to FieldState so we have all the data for preview
					const state = this.nodeState();
					if (state) {
						state.value.set(progress.result);
						state.markAsTouched();
					}
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
				const state = this.nodeState();
				if (state) {
					state.value.set(result.media);
					state.markAsTouched();
				}
			}
		});
	}

	/**
	 * Remove the current media value.
	 */
	removeMedia(): void {
		const state = this.nodeState();
		if (state) {
			state.value.set(null);
		}
	}
}

/**
 * Upload zone component for upload collections.
 * Shows a drag-and-drop zone above the form fields.
 * When a file is selected, emits the file for the parent entity form to handle.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { Button, Progress } from '@momentumcms/ui';
import type { UploadCollectionConfig } from '@momentumcms/core';
import { NgIcon } from '@ng-icons/core';
import { heroCloudArrowUp, heroXMark } from '@ng-icons/heroicons/outline';
import {
	MediaPreviewComponent,
	type MediaPreviewData,
} from '../../widgets/media-preview/media-preview.component';

/**
 * Get string property from an unknown object.
 */
function getStringProp(obj: unknown, key: string): string | undefined {
	if (typeof obj !== 'object' || obj === null) return undefined;
	if (!(key in obj)) return undefined;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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

@Component({
	selector: 'mcms-collection-upload-zone',
	imports: [Button, Progress, NgIcon, MediaPreviewComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block mb-6' },
	template: `
		@if (pendingFile()) {
			<!-- File selected preview -->
			<div class="rounded-lg border border-mcms-border bg-mcms-card p-4">
				<div class="flex items-center gap-4">
					<mcms-media-preview [media]="previewData()" size="lg" />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{{ pendingFile()!.name }}</p>
						<p class="text-xs text-mcms-muted-foreground">
							{{ formatFileSize(pendingFile()!.size) }} &middot; {{ pendingFile()!.type }}
						</p>
						@if (isUploading()) {
							<mcms-progress [value]="uploadProgress()" class="mt-2" />
							<p class="mt-1 text-xs text-mcms-muted-foreground">
								{{ uploadProgress() }}% uploaded
							</p>
						}
					</div>
					@if (!isUploading()) {
						<button
							mcms-button
							variant="ghost"
							size="sm"
							type="button"
							(click)="removeFile()"
							aria-label="Remove selected file"
						>
							<ng-icon [name]="xMarkIcon" class="h-4 w-4" />
						</button>
					}
				</div>
			</div>
		} @else if (existingMediaPreview()) {
			<!-- Existing file preview (edit mode) -->
			<div class="rounded-lg border border-mcms-border bg-mcms-card p-4">
				<div class="flex items-center gap-4">
					<mcms-media-preview [media]="existingMediaPreview()" size="lg" />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{{ existingFilename() }}</p>
						<p class="text-xs text-mcms-muted-foreground">{{ existingMimeType() }}</p>
					</div>
					@if (!disabled()) {
						<button
							mcms-button
							variant="ghost"
							size="sm"
							type="button"
							(click)="triggerFileInput()"
							aria-label="Replace file"
						>
							Replace
						</button>
					}
				</div>
				<input
					#fileInput
					type="file"
					class="sr-only"
					[accept]="acceptAttribute()"
					[disabled]="disabled()"
					(change)="onFileSelected($event)"
					aria-label="Choose file to upload"
				/>
			</div>
		} @else {
			<!-- Drop zone -->
			<div
				class="relative rounded-lg border-2 border-dashed transition-colors"
				[class.border-mcms-border]="!isDragging()"
				[class.border-mcms-primary]="isDragging()"
				[class.bg-mcms-primary/5]="isDragging()"
				[class.cursor-pointer]="!disabled()"
				[class.opacity-50]="disabled()"
				tabindex="0"
				role="button"
				[attr.aria-disabled]="disabled()"
				aria-label="Upload file. Drag and drop or click to browse."
				(dragover)="onDragOver($event)"
				(dragleave)="onDragLeave($event)"
				(drop)="onDrop($event)"
				(click)="triggerFileInput()"
				(keydown.enter)="triggerFileInput()"
				(keydown.space)="triggerFileInput()"
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
				<input
					#fileInput
					type="file"
					class="sr-only"
					[accept]="acceptAttribute()"
					[disabled]="disabled()"
					(change)="onFileSelected($event)"
					aria-label="Choose file to upload"
				/>
			</div>
		}

		@if (error()) {
			<p class="mt-1 text-sm text-mcms-destructive">{{ error() }}</p>
		}
	`,
})
export class CollectionUploadZoneComponent {
	/** Reference to the hidden file input */
	private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

	/** Upload config from the collection */
	readonly uploadConfig = input<UploadCollectionConfig | undefined>(undefined);

	/** Whether the zone is disabled */
	readonly disabled = input(false);

	/** Currently selected file (read from parent) */
	readonly pendingFile = input<File | null>(null);

	/** Whether an upload is in progress */
	readonly isUploading = input(false);

	/** Upload progress percentage */
	readonly uploadProgress = input(0);

	/** Error message */
	readonly error = input<string | null>(null);

	/** Existing media data for edit mode (filename, mimeType, path, url) */
	readonly existingMedia = input<Record<string, unknown> | null>(null);

	/** Emitted when a file is selected */
	readonly fileSelected = output<File>();

	/** Emitted when the file is removed */
	readonly fileRemoved = output<void>();

	/** Icons */
	readonly uploadIcon = heroCloudArrowUp;
	readonly xMarkIcon = heroXMark;

	/** Drag state */
	readonly isDragging = signal(false);

	/** Cached object URL for file preview (managed to prevent memory leaks) */
	private readonly previewUrl = signal<string | null>(null);

	constructor() {
		// Manage object URL lifecycle: create when file changes, revoke old one
		effect((onCleanup) => {
			const file = this.pendingFile();
			if (file) {
				const url = URL.createObjectURL(file);
				this.previewUrl.set(url);
				onCleanup(() => URL.revokeObjectURL(url));
			} else {
				this.previewUrl.set(null);
			}
		});
	}

	/** Preview data for the pending file */
	readonly previewData = computed((): MediaPreviewData | null => {
		const file = this.pendingFile();
		if (!file) return null;
		return {
			mimeType: file.type,
			filename: file.name,
			url: this.previewUrl() ?? undefined,
		};
	});

	/** Preview data for existing media (edit mode) */
	readonly existingMediaPreview = computed((): MediaPreviewData | null => {
		const media = this.existingMedia();
		if (!media) return null;
		return {
			url: getStringProp(media, 'url'),
			path: getStringProp(media, 'path'),
			mimeType: getStringProp(media, 'mimeType'),
			filename: getStringProp(media, 'filename'),
			alt: getStringProp(media, 'alt'),
		};
	});

	/** Filename of existing media */
	readonly existingFilename = computed(() => {
		return getStringProp(this.existingMedia(), 'filename') ?? 'Uploaded file';
	});

	/** MIME type of existing media */
	readonly existingMimeType = computed(() => {
		return getStringProp(this.existingMedia(), 'mimeType') ?? '';
	});

	/** MIME types hint for display */
	readonly mimeTypesHint = computed(() => {
		const mimeTypes = this.uploadConfig()?.mimeTypes;
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
		const maxSize = this.uploadConfig()?.maxFileSize;
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
		const mimeTypes = this.uploadConfig()?.mimeTypes;
		if (!mimeTypes || mimeTypes.length === 0) return '*/*';
		return mimeTypes.join(',');
	});

	/**
	 * Format file size for display.
	 */
	formatFileSize(bytes: number): string {
		if (bytes >= 1024 * 1024 * 1024) {
			return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
		}
		if (bytes >= 1024 * 1024) {
			return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		}
		if (bytes >= 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}
		return `${bytes} bytes`;
	}

	/**
	 * Handle drag over event.
	 */
	onDragOver(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		if (!this.disabled()) {
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

		if (this.disabled()) return;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			this.fileSelected.emit(files[0]);
		}
	}

	/**
	 * Trigger hidden file input click.
	 */
	triggerFileInput(): void {
		if (this.disabled()) return;

		const ref = this.fileInputRef();
		if (ref) {
			ref.nativeElement.click();
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
			this.fileSelected.emit(files[0]);
		}
		// Reset input so same file can be selected again
		input.value = '';
	}

	/**
	 * Remove the pending file.
	 */
	removeFile(): void {
		this.fileRemoved.emit();
	}
}

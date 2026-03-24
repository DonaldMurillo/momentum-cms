import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCloudArrowUp, heroXMark } from '@ng-icons/heroicons/outline';
import { Button } from '@momentumcms/ui';
import { UploadService, type UploadProgress } from '../../services/upload.service';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { MediaPreviewComponent } from '../media-preview/media-preview.component';
import type { FolderNode } from '../media-folder-tree/media-folder-tree.component';
import type { MediaTag } from '../media-tag-filter/media-tag-filter.component';

interface UploadItem {
	file: File;
	progress: number;
	status: UploadProgress['status'];
	error?: string;
	resultId?: string;
}

@Component({
	selector: 'mcms-media-upload-zone',
	imports: [NgIcon, Button, MediaPreviewComponent],
	providers: [provideIcons({ heroCloudArrowUp, heroXMark })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<!-- Pre-assignment selectors -->
		<div class="mb-3 flex flex-wrap items-center gap-3">
			@if (folders().length > 0) {
				<div class="flex items-center gap-2">
					<label for="upload-folder" class="text-xs font-medium text-[hsl(var(--mcms-muted-foreground))]">
						Folder:
					</label>
					<select
						id="upload-folder"
						class="rounded-md border border-[hsl(var(--mcms-border))] bg-[hsl(var(--mcms-card))] px-2 py-1 text-sm"
						[value]="selectedFolderId() ?? ''"
						(change)="onFolderChange($event)"
						data-slot="folder-select"
					>
						<option value="">None</option>
						@for (folder of folders(); track folder.id) {
							<option [value]="folder.id">{{ folder.name }}</option>
						}
					</select>
				</div>
			}

			@if (tags().length > 0) {
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-[hsl(var(--mcms-muted-foreground))]">Tags:</span>
					<div class="flex flex-wrap gap-1">
						@for (tag of tags(); track tag.id) {
							<button
								type="button"
								class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
								[class.bg-[hsl(var(--mcms-primary))]]="selectedTagIds().has(tag.id)"
								[class.text-[hsl(var(--mcms-primary-foreground))]]="selectedTagIds().has(tag.id)"
								[class.border-[hsl(var(--mcms-primary))]]="selectedTagIds().has(tag.id)"
								[class.border-[hsl(var(--mcms-border))]]="!selectedTagIds().has(tag.id)"
								(click)="toggleTag(tag.id)"
								[attr.data-tag-id]="tag.id"
							>
								{{ tag.name }}
							</button>
						}
					</div>
				</div>
			}
		</div>

		<!-- Drop zone -->
		<div
			class="relative flex min-h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors"
			[class.border-[hsl(var(--mcms-border))]]="!isDragOver()"
			[class.border-[hsl(var(--mcms-primary))]]="isDragOver()"
			[class.bg-[hsl(var(--mcms-primary)/0.05)]]="isDragOver()"
			(dragover)="onDragOver($event)"
			(dragleave)="onDragLeave($event)"
			(drop)="onDrop($event)"
			data-slot="drop-zone"
			role="region"
			aria-label="File upload drop zone"
		>
			<input
				#fileInput
				type="file"
				class="sr-only"
				multiple
				(change)="onFilesSelected($event)"
				aria-label="Upload files"
			/>
			<ng-icon name="heroCloudArrowUp" class="mb-2 h-8 w-8 text-[hsl(var(--mcms-muted-foreground))]" aria-hidden="true" />
			<p class="text-sm text-[hsl(var(--mcms-muted-foreground))]">
				Drag & drop files here or
				<button
					type="button"
					class="font-medium text-[hsl(var(--mcms-primary))] underline"
					(click)="fileInputEl().nativeElement.click()"
				>
					browse
				</button>
			</p>
		</div>

		<!-- Upload queue -->
		@if (uploads().length > 0) {
			<div class="mt-3 space-y-2" data-slot="upload-queue">
				@for (item of uploads(); track item.file.name) {
					<div class="flex items-center gap-3 rounded-md border border-[hsl(var(--mcms-border))] p-2">
						<mcms-media-preview
							[media]="{ mimeType: item.file.type, filename: item.file.name }"
							size="sm"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm">{{ item.file.name }}</p>
							@if (item.status === 'error') {
								<p class="text-xs text-[hsl(var(--mcms-destructive))]">{{ item.error }}</p>
							} @else {
								<div
									class="mt-1 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--mcms-muted))]"
									role="progressbar"
									[attr.aria-valuenow]="item.progress"
									aria-valuemin="0"
									aria-valuemax="100"
								>
									<div
										class="h-full transition-all"
										[class.bg-[hsl(var(--mcms-primary))]]="item.status !== 'complete'"
										[class.bg-green-500]="item.status === 'complete'"
										[style.width.%]="item.progress"
									></div>
								</div>
							}
						</div>
						<span class="text-xs text-[hsl(var(--mcms-muted-foreground))]">
							{{ item.progress }}%
						</span>
					</div>
				}
			</div>
		}
	`,
})
export class MediaUploadZoneComponent {
	readonly folders = input<FolderNode[]>([]);
	readonly tags = input<MediaTag[]>([]);

	readonly uploadComplete = output<void>();

	readonly selectedFolderId = signal<string | null>(null);
	readonly selectedTagIds = signal<Set<string>>(new Set());
	readonly isDragOver = signal(false);
	readonly uploads = signal<UploadItem[]>([]);

	readonly fileInputEl = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

	private readonly uploadService = inject(UploadService);
	private readonly api = injectMomentumAPI();

	onFolderChange(event: Event): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DOM event target narrowing
		const select = event.target as HTMLSelectElement;
		this.selectedFolderId.set(select.value || null);
	}

	toggleTag(tagId: string): void {
		const ids = new Set(this.selectedTagIds());
		if (ids.has(tagId)) {
			ids.delete(tagId);
		} else {
			ids.add(tagId);
		}
		this.selectedTagIds.set(ids);
	}

	onDragOver(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver.set(true);
	}

	onDragLeave(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver.set(false);
	}

	onDrop(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver.set(false);
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			this.processFiles(Array.from(files));
		}
	}

	onFilesSelected(event: Event): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DOM event target narrowing
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;
		this.processFiles(Array.from(input.files));
		input.value = '';
	}

	private processFiles(files: File[]): void {
		const items: UploadItem[] = files.map((file) => ({
			file,
			progress: 0,
			status: 'pending' as const,
		}));
		this.uploads.set([...this.uploads(), ...items]);

		for (const file of files) {
			this.uploadService.upload(file).subscribe({
				next: (progress) => {
					this.updateUpload(file, {
						progress: progress.progress,
						status: progress.status,
						error: progress.error,
						resultId: progress.result?.id,
					});

					if (progress.status === 'complete' && progress.result) {
						this.assignMetadata(progress.result.id);
					}
				},
				error: (err: Error) => {
					this.updateUpload(file, {
						status: 'error',
						progress: 0,
						error: err.message,
					});
				},
			});
		}
	}

	private updateUpload(file: File, partial: Partial<UploadItem>): void {
		this.uploads.set(this.uploads().map((u) => (u.file === file ? { ...u, ...partial } : u)));
	}

	private async assignMetadata(mediaId: string): Promise<void> {
		const folderId = this.selectedFolderId();
		const tagIds = Array.from(this.selectedTagIds());

		if (!folderId && tagIds.length === 0) {
			this.uploadComplete.emit();
			return;
		}

		try {
			const data: Record<string, unknown> = {};
			if (folderId) data['folder'] = folderId;
			if (tagIds.length > 0) data['tags'] = tagIds;

			await this.api.collection('media').update(mediaId, data);
		} catch {
			// Non-critical — file uploaded but metadata assignment failed
		}

		this.uploadComplete.emit();
	}
}

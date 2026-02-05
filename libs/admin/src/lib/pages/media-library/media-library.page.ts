import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	effect,
	DestroyRef,
} from '@angular/core';
import { type Subscription } from 'rxjs';
import { Button, Spinner, Pagination, SearchInput, Badge, ToastService } from '@momentum-cms/ui';
import { NgIcon } from '@ng-icons/core';
import {
	heroCloudArrowUp,
	heroTrash,
	heroArrowDownTray,
	heroEye,
} from '@ng-icons/heroicons/outline';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { UploadService, type UploadProgress } from '../../services/upload.service';
import { FeedbackService } from '../../widgets/feedback/feedback.service';
import { MediaPreviewComponent } from '../../widgets/media-preview/media-preview.component';

/** Helper type to represent media document from API */
interface MediaItem {
	id: string;
	filename: string;
	mimeType: string;
	path: string;
	url?: string;
	filesize?: number;
	alt?: string;
	width?: number;
	height?: number;
}

/**
 * Type guard to check if value is MediaItem.
 * Note: Type assertion is required for type guard functions.
 */
function isMediaItem(value: unknown): value is MediaItem {
	if (typeof value !== 'object' || value === null) return false;
	// Type guard requires accessing unknown object - eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const obj = value as Record<string, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions
	return (
		typeof obj['id'] === 'string' &&
		typeof obj['filename'] === 'string' &&
		typeof obj['mimeType'] === 'string' &&
		typeof obj['path'] === 'string'
	);
}

/**
 * Convert API docs to MediaItem array.
 */
function toMediaItems(docs: unknown): MediaItem[] {
	if (!Array.isArray(docs)) return [];
	return docs.filter(isMediaItem);
}

/**
 * Get HTMLInputElement from event safely.
 */
function getInputElement(event: Event): HTMLInputElement | null {
	const target = event.target;
	if (target instanceof HTMLInputElement) {
		return target;
	}
	return null;
}

/**
 * Media Library Page
 *
 * Full-page view for managing media files: browse, upload, and delete.
 */
@Component({
	selector: 'mcms-media-library',
	imports: [Button, Spinner, Pagination, SearchInput, Badge, NgIcon, MediaPreviewComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="space-y-6">
			<!-- Header -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 class="text-2xl font-bold tracking-tight">Media Library</h1>
					<p class="text-sm text-mcms-muted-foreground">
						{{ totalDocs() }} file{{ totalDocs() === 1 ? '' : 's' }}
					</p>
				</div>
				<div class="flex gap-2">
					<label class="cursor-pointer">
						<input
							type="file"
							class="sr-only"
							multiple
							(change)="onFilesSelected($event)"
						/>
						<span
							mcms-button
							class="inline-flex"
						>
							<ng-icon [name]="uploadIcon" class="h-4 w-4" />
							Upload Files
						</span>
					</label>
				</div>
			</div>

			<!-- Search and filters -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
				<mcms-search-input
					placeholder="Search media..."
					[value]="searchQuery()"
					(valueChange)="onSearchChange($event)"
					class="flex-1"
				/>
				@if (selectedItems().size > 0) {
					<div class="flex items-center gap-2">
						<mcms-badge variant="secondary">
							{{ selectedItems().size }} selected
						</mcms-badge>
						<button
							mcms-button
							variant="destructive"
							size="sm"
							(click)="deleteSelected()"
						>
							<ng-icon [name]="trashIcon" class="h-4 w-4" />
							Delete
						</button>
					</div>
				}
			</div>

			<!-- Upload progress -->
			@if (activeUploads().length > 0) {
				<div class="rounded-lg border border-mcms-border bg-mcms-muted/50 p-4">
					<h3 class="mb-2 font-medium">Uploading files...</h3>
					<div class="space-y-2">
						@for (upload of activeUploads(); track upload.file.name) {
							<div class="flex items-center gap-3">
								<mcms-media-preview
									[media]="{ mimeType: upload.file.type, filename: upload.file.name }"
									size="sm"
								/>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm">{{ upload.file.name }}</p>
									<div class="mt-1 h-2 overflow-hidden rounded-full bg-mcms-muted">
										<div
											class="h-full bg-mcms-primary transition-all"
											[style.width.%]="upload.progress"
										></div>
									</div>
								</div>
								<span class="text-xs text-mcms-muted-foreground">
									{{ upload.progress }}%
								</span>
							</div>
						}
					</div>
				</div>
			}

			<!-- Content -->
			@if (isLoading()) {
				<div class="flex h-64 items-center justify-center">
					<mcms-spinner size="lg" />
				</div>
			} @else if (mediaItems().length === 0) {
				<div class="flex h-64 flex-col items-center justify-center text-mcms-muted-foreground">
					<ng-icon [name]="uploadIcon" class="mb-4 h-16 w-16 opacity-50" />
					@if (searchQuery()) {
						<p class="text-lg">No media found</p>
						<p class="text-sm">Try a different search term</p>
					} @else {
						<p class="text-lg">No media uploaded yet</p>
						<p class="text-sm">Upload files to get started</p>
					}
				</div>
			} @else {
				<!-- Media grid -->
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					@for (media of mediaItems(); track media.id) {
						<div
							class="group relative overflow-hidden rounded-lg border transition-all"
							[class.border-mcms-border]="!selectedItems().has(media.id)"
							[class.border-mcms-primary]="selectedItems().has(media.id)"
							[class.ring-2]="selectedItems().has(media.id)"
							[class.ring-mcms-primary/50]="selectedItems().has(media.id)"
						>
							<!-- Selection checkbox -->
							<div class="absolute left-2 top-2 z-10">
								<input
									type="checkbox"
									class="h-4 w-4 cursor-pointer rounded border-mcms-border"
									[checked]="selectedItems().has(media.id)"
									(change)="toggleSelection(media)"
								/>
							</div>

							<!-- Preview -->
							<button
								type="button"
								class="block aspect-square w-full"
								(click)="viewMedia(media)"
							>
								<mcms-media-preview
									[media]="media"
									size="xl"
									[rounded]="false"
									class="h-full w-full"
								/>
							</button>

							<!-- Hover overlay -->
							<div
								class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<p class="truncate text-sm font-medium text-white">
									{{ media.filename }}
								</p>
								<p class="text-xs text-white/70">
									{{ formatFileSize(media.filesize) }}
								</p>
								<div class="mt-2 flex gap-1">
									<button
										mcms-button
										variant="secondary"
										size="sm"
										type="button"
										(click)="$event.stopPropagation(); viewMedia(media)"
									>
										<ng-icon [name]="eyeIcon" class="h-3 w-3" />
									</button>
									<a
										mcms-button
										variant="secondary"
										size="sm"
										[href]="getMediaUrl(media)"
										target="_blank"
										download
										(click)="$event.stopPropagation()"
									>
										<ng-icon [name]="downloadIcon" class="h-3 w-3" />
									</a>
									<button
										mcms-button
										variant="destructive"
										size="sm"
										type="button"
										(click)="$event.stopPropagation(); deleteMedia(media)"
									>
										<ng-icon [name]="trashIcon" class="h-3 w-3" />
									</button>
								</div>
							</div>
						</div>
					}
				</div>

				<!-- Pagination -->
				@if (totalPages() > 1) {
					<div class="flex justify-center pt-4">
						<mcms-pagination
							[currentPage]="currentPage()"
							[totalPages]="totalPages()"
							(pageChange)="onPageChange($event)"
						/>
					</div>
				}
			}
		</div>
	`,
})
export class MediaLibraryPage {
	private readonly api = injectMomentumAPI();
	private readonly uploadService = inject(UploadService);
	private readonly feedback = inject(FeedbackService);
	private readonly toast = inject(ToastService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly uploadSubscriptions: Subscription[] = [];

	/** Icon references */
	readonly uploadIcon = heroCloudArrowUp;
	readonly trashIcon = heroTrash;
	readonly downloadIcon = heroArrowDownTray;
	readonly eyeIcon = heroEye;

	/** Internal state */
	readonly isLoading = signal(true);
	readonly mediaItems = signal<MediaItem[]>([]);
	readonly searchQuery = signal('');
	readonly currentPage = signal(1);
	readonly totalPages = signal(1);
	readonly totalDocs = signal(0);
	readonly limit = signal(24);
	readonly selectedItems = signal<Set<string>>(new Set());
	readonly activeUploads = signal<UploadProgress[]>([]);

	constructor() {
		// Load media on init and when search/page changes
		effect(() => {
			const query = this.searchQuery();
			const page = this.currentPage();
			this.loadMedia(query, page);
		});

		// Clean up upload subscriptions on destroy
		this.destroyRef.onDestroy(() => {
			for (const sub of this.uploadSubscriptions) {
				sub.unsubscribe();
			}
			this.uploadSubscriptions.length = 0;
		});
	}

	/**
	 * Load media from the API.
	 */
	private async loadMedia(search: string, page: number): Promise<void> {
		this.isLoading.set(true);

		try {
			const collection = this.api.collection('media');
			const whereClause: Record<string, unknown> = {};

			if (search) {
				whereClause['filename'] = { contains: search };
			}

			const result = await collection.find({
				where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
				page,
				limit: this.limit(),
				sort: '-createdAt',
			});

			this.mediaItems.set(toMediaItems(result.docs));
			this.totalDocs.set(result.totalDocs);
			this.totalPages.set(result.totalPages);
		} catch (error) {
			console.error('Failed to load media:', error);
			this.feedback.operationFailed('Failed to load media');
			this.mediaItems.set([]);
		} finally {
			this.isLoading.set(false);
		}
	}

	/**
	 * Handle search query change.
	 */
	onSearchChange(query: string): void {
		this.searchQuery.set(query);
		this.currentPage.set(1);
	}

	/**
	 * Handle page change.
	 */
	onPageChange(page: number): void {
		this.currentPage.set(page);
	}

	/**
	 * Handle file selection from input.
	 */
	onFilesSelected(event: Event): void {
		const input = getInputElement(event);
		if (!input) return;
		const files = input.files;
		if (!files || files.length === 0) return;

		const uploads: UploadProgress[] = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			uploads.push({
				status: 'pending',
				progress: 0,
				file,
			});
		}

		this.activeUploads.set(uploads);

		// Upload each file
		for (const file of Array.from(files)) {
			const sub = this.uploadService.upload(file).subscribe({
				next: (progress) => {
					this.updateUploadProgress(file, progress);

					if (progress.status === 'complete') {
						this.removeUpload(file);
						// Reload media list
						this.loadMedia(this.searchQuery(), this.currentPage());
					} else if (progress.status === 'error') {
						this.removeUpload(file);
						this.toast.error(`Upload failed`, `Failed to upload ${file.name}: ${progress.error}`);
					}
				},
				error: (err: Error) => {
					this.removeUpload(file);
					this.toast.error(`Upload failed`, `Failed to upload ${file.name}: ${err.message}`);
				},
			});
			this.uploadSubscriptions.push(sub);
		}

		// Reset input
		input.value = '';
	}

	/**
	 * Update upload progress in the active uploads list.
	 */
	private updateUploadProgress(file: File, progress: UploadProgress): void {
		const uploads = this.activeUploads().map((u) => (u.file === file ? progress : u));
		this.activeUploads.set(uploads);
	}

	/**
	 * Remove upload from active uploads list.
	 */
	private removeUpload(file: File): void {
		const uploads = this.activeUploads().filter((u) => u.file !== file);
		this.activeUploads.set(uploads);
	}

	/**
	 * Toggle selection of a media item.
	 */
	toggleSelection(media: MediaItem): void {
		const selected = new Set(this.selectedItems());
		if (selected.has(media.id)) {
			selected.delete(media.id);
		} else {
			selected.add(media.id);
		}
		this.selectedItems.set(selected);
	}

	/**
	 * View media details.
	 */
	viewMedia(media: MediaItem): void {
		// Open in new tab for now
		// In future, could show a modal with full details
		window.open(this.getMediaUrl(media), '_blank');
	}

	/**
	 * Delete a single media item.
	 */
	async deleteMedia(media: MediaItem): Promise<void> {
		const confirmed = await this.feedback.confirmDelete('Media', media.filename);

		if (!confirmed) return;

		try {
			const collection = this.api.collection('media');
			await collection.delete(media.id);
			this.feedback.entityDeleted('Media');
			this.loadMedia(this.searchQuery(), this.currentPage());
		} catch (error) {
			console.error('Failed to delete media:', error);
			this.feedback.operationFailed('Failed to delete media');
		}
	}

	/**
	 * Delete all selected media items.
	 */
	async deleteSelected(): Promise<void> {
		const count = this.selectedItems().size;
		const confirmed = await this.feedback.confirmBulkDelete('Files', count);

		if (!confirmed) return;

		try {
			const collection = this.api.collection('media');
			const ids = Array.from(this.selectedItems());

			// Delete all selected items
			await Promise.all(ids.map((id) => collection.delete(id)));

			this.feedback.entitiesDeleted('Files', count);
			this.selectedItems.set(new Set());
			this.loadMedia(this.searchQuery(), this.currentPage());
		} catch (error) {
			console.error('Failed to delete media:', error);
			this.feedback.operationFailed('Failed to delete some files');
		}
	}

	/**
	 * Get the URL for a media document.
	 */
	getMediaUrl(media: MediaItem): string {
		return media.url ?? `/api/media/file/${media.path}`;
	}

	/**
	 * Format file size for display.
	 */
	formatFileSize(bytes?: number): string {
		if (!bytes) return 'Unknown size';

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
}

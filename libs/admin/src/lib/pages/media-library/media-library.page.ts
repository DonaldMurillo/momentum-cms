import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	effect,
	DestroyRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { type Subscription, firstValueFrom } from 'rxjs';
import {
	Button,
	Spinner,
	Pagination,
	SearchInput,
	Badge,
	ToastService,
	DialogService,
} from '@momentumcms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroCloudArrowUp,
	heroTrash,
	heroArrowDownTray,
	heroEye,
	heroPencilSquare,
	heroFolderPlus,
	heroTag,
} from '@ng-icons/heroicons/outline';
import type { ImageSizeConfig } from '@momentumcms/core';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { UploadService, type UploadProgress } from '../../services/upload.service';
import { getCollectionsFromRouteData } from '../../utils/route-data';
import { FeedbackService } from '../../widgets/feedback/feedback.service';
import { MediaPreviewComponent } from '../../widgets/media-preview/media-preview.component';
import {
	MediaEditDialog,
	type MediaEditResult,
} from '../../widgets/media-edit/media-edit-dialog.component';
import {
	MediaFolderTreeComponent,
	type FolderNode,
} from '../../widgets/media-folder-tree/media-folder-tree.component';
import {
	MediaTagFilterComponent,
	type MediaTag,
} from '../../widgets/media-tag-filter/media-tag-filter.component';
import {
	MediaFilterPanelComponent,
	buildFilterWhere,
	type MediaFilterState,
} from '../../widgets/media-filter-panel/media-filter-panel.component';
import { MediaUploadZoneComponent } from '../../widgets/media-upload-zone/media-upload-zone.component';
import {
	PromptDialog,
	type PromptDialogData,
	SelectDialog,
	type SelectDialogData,
} from './prompt-dialog.component';

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
	focalPoint?: { x: number; y: number };
	folder?: string | null;
	tags?: string[];
}

/**
 * Type guard to check if value is MediaItem.
 */
function isMediaItem(value: unknown): value is MediaItem {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions
	return (
		typeof obj['id'] === 'string' &&
		typeof obj['filename'] === 'string' &&
		typeof obj['mimeType'] === 'string' &&
		typeof obj['path'] === 'string'
	);
}

function toMediaItems(docs: unknown): MediaItem[] {
	if (!Array.isArray(docs)) return [];
	return docs.filter(isMediaItem);
}

function getInputElement(event: Event): HTMLInputElement | null {
	const target = event.target;
	if (target instanceof HTMLInputElement) {
		return target;
	}
	return null;
}

/**
 * Media Library Page — Enhanced with folder/tag organization,
 * filter panel, and bulk actions.
 */
@Component({
	selector: 'mcms-media-library',
	imports: [
		Button,
		Spinner,
		Pagination,
		SearchInput,
		Badge,
		NgIcon,
		MediaPreviewComponent,
		MediaFolderTreeComponent,
		MediaTagFilterComponent,
		MediaFilterPanelComponent,
		MediaUploadZoneComponent,
	],
	providers: [
		provideIcons({
			heroCloudArrowUp,
			heroTrash,
			heroArrowDownTray,
			heroEye,
			heroPencilSquare,
			heroFolderPlus,
			heroTag,
		}),
	],
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
					<button
						mcms-button
						type="button"
						(click)="showUploadZone.set(!showUploadZone())"
					>
						<ng-icon name="heroCloudArrowUp" class="h-4 w-4" />
						Upload Files
					</button>
				</div>
			</div>

			<!-- Upload zone (collapsible) -->
			@if (showUploadZone()) {
				<mcms-media-upload-zone
					[folders]="allFolders()"
					[tags]="allTags()"
					(uploadComplete)="onUploadComplete()"
					data-slot="upload-zone"
				/>
			}

			<!-- Main layout: sidebar + content -->
			<div class="flex gap-6">
				<!-- Sidebar: Folder tree -->
				<div class="hidden w-56 shrink-0 md:block" data-slot="sidebar">
					<mcms-media-folder-tree
						[folders]="allFolders()"
						[selectedFolderId]="selectedFolderId()"
						(folderSelected)="onFolderSelected($event)"
						(createFolderClicked)="createFolder()"
					/>
				</div>

				<!-- Content -->
				<div class="min-w-0 flex-1">
					<!-- Search + Tags + Filters -->
					<div class="space-y-3">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
							<mcms-search-input
								placeholder="Search media..."
								[value]="searchQuery()"
								(valueChange)="onSearchChange($event)"
								class="flex-1"
								aria-label="Search media files"
							/>
							<mcms-media-filter-panel
								(filterChanged)="onFilterChanged($event)"
							/>
						</div>

						<!-- Tag filter chips -->
						<mcms-media-tag-filter
							[tags]="allTags()"
							[selectedTagIds]="selectedTagIds()"
							(tagSelectionChanged)="onTagSelectionChanged($event)"
							(createTagClicked)="createTag()"
						/>
					</div>

					<!-- Bulk actions -->
					@if (selectedItems().size > 0) {
						<div class="mt-3 flex items-center gap-2" data-slot="bulk-actions">
							<mcms-badge variant="secondary">
								{{ selectedItems().size }} selected
							</mcms-badge>
							<button
								mcms-button
								variant="secondary"
								size="sm"
								(click)="bulkMoveToFolder()"
							>
								<ng-icon name="heroFolderPlus" class="h-4 w-4" aria-hidden="true" />
								Move
							</button>
							<button
								mcms-button
								variant="secondary"
								size="sm"
								(click)="bulkTag()"
							>
								<ng-icon name="heroTag" class="h-4 w-4" aria-hidden="true" />
								Tag
							</button>
							<button
								mcms-button
								variant="destructive"
								size="sm"
								(click)="deleteSelected()"
							>
								<ng-icon name="heroTrash" class="h-4 w-4" aria-hidden="true" />
								Delete
							</button>
						</div>
					}

					<!-- Content -->
					@if (isLoading()) {
						<div class="flex h-64 items-center justify-center">
							<mcms-spinner size="lg" />
						</div>
					} @else if (mediaItems().length === 0) {
						<div class="flex h-64 flex-col items-center justify-center text-mcms-muted-foreground">
							<ng-icon name="heroCloudArrowUp" class="mb-4 h-16 w-16 opacity-50" aria-hidden="true" />
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
						<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
											[attr.aria-label]="'Select ' + media.filename"
										/>
									</div>

									<!-- Preview -->
									<button
										type="button"
										class="block aspect-square w-full"
										(click)="viewMedia(media)"
										[attr.aria-label]="'View ' + media.filename"
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
										class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
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
												(click)="$event.stopPropagation(); editMedia(media)"
												aria-label="Edit file details"
											>
												<ng-icon name="heroPencilSquare" class="h-3 w-3" aria-hidden="true" />
											</button>
											<button
												mcms-button
												variant="secondary"
												size="sm"
												type="button"
												(click)="$event.stopPropagation(); viewMedia(media)"
												aria-label="View file"
											>
												<ng-icon name="heroEye" class="h-3 w-3" aria-hidden="true" />
											</button>
											<a
												mcms-button
												variant="secondary"
												size="sm"
												[href]="getMediaUrl(media)"
												target="_blank"
												download
												(click)="$event.stopPropagation()"
												aria-label="Download file"
											>
												<ng-icon name="heroArrowDownTray" class="h-3 w-3" aria-hidden="true" />
											</a>
											<button
												mcms-button
												variant="destructive"
												size="sm"
												type="button"
												(click)="$event.stopPropagation(); deleteMedia(media)"
												aria-label="Delete file"
											>
												<ng-icon name="heroTrash" class="h-3 w-3" aria-hidden="true" />
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
			</div>
		</div>
	`,
})
export class MediaLibraryPage {
	private readonly document = inject(DOCUMENT);
	private readonly route = inject(ActivatedRoute);
	private readonly api = injectMomentumAPI();
	private readonly uploadService = inject(UploadService);
	private readonly feedback = inject(FeedbackService);
	private readonly toast = inject(ToastService);
	private readonly dialog = inject(DialogService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly uploadSubscriptions: Subscription[] = [];
	private loadRequestId = 0;

	readonly mediaImageSizes: ImageSizeConfig[] = (() => {
		const collections = getCollectionsFromRouteData(this.route.parent?.snapshot.data);
		const mediaColl = collections.find((c) => c.slug === 'media');
		return mediaColl?.upload?.imageSizes ?? [];
	})();

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
	readonly showUploadZone = signal(false);

	/** Folder/Tag organization state */
	readonly allFolders = signal<FolderNode[]>([]);
	readonly allTags = signal<MediaTag[]>([]);
	readonly selectedFolderId = signal<string | null>(null);
	readonly selectedTagIds = signal<Set<string>>(new Set());
	readonly filterState = signal<MediaFilterState>({
		mimeCategory: null,
		dateRange: null,
		sizePreset: null,
	});

	constructor() {
		// Load media on init and when filters change
		effect(() => {
			const query = this.searchQuery();
			const page = this.currentPage();
			const folderId = this.selectedFolderId();
			const tagIds = this.selectedTagIds();
			const filters = this.filterState();
			this.loadMedia(query, page, folderId, tagIds, filters);
		});

		// Load folders and tags
		this.loadFolders();
		this.loadTags();

		this.destroyRef.onDestroy(() => {
			for (const sub of this.uploadSubscriptions) {
				sub.unsubscribe();
			}
			this.uploadSubscriptions.length = 0;
		});
	}

	/** Load media from the API with compound filters. */
	private async loadMedia(
		search: string,
		page: number,
		folderId: string | null,
		tagIds: Set<string>,
		filters: MediaFilterState,
	): Promise<void> {
		const requestId = ++this.loadRequestId;
		this.isLoading.set(true);

		try {
			const whereClause: Record<string, unknown> = {};

			if (search) {
				whereClause['or'] = [{ filename: { contains: search } }, { alt: { contains: search } }];
			}

			if (folderId) {
				whereClause['folder'] = { equals: folderId };
			}

			if (tagIds.size > 0) {
				whereClause['tags'] = { in: Array.from(tagIds) };
			}

			// Merge filter panel where clauses
			const filterWhere = buildFilterWhere(filters);
			Object.assign(whereClause, filterWhere);

			const result = await this.api.collection('media').find({
				where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
				page,
				limit: this.limit(),
				sort: '-createdAt',
			});

			// Discard stale responses — a newer request was fired while we awaited
			if (requestId !== this.loadRequestId) return;

			this.mediaItems.set(toMediaItems(result.docs));
			this.totalDocs.set(result.totalDocs);
			this.totalPages.set(result.totalPages);
		} catch (error) {
			if (requestId !== this.loadRequestId) return;
			console.error('Failed to load media:', error);
			this.feedback.operationFailed('Failed to load media');
			this.mediaItems.set([]);
		} finally {
			if (requestId === this.loadRequestId) {
				this.isLoading.set(false);
			}
		}
	}

	/** Load folders from media-folders collection. */
	private async loadFolders(): Promise<void> {
		try {
			const result = await this.api.collection('media-folders').find({
				limit: 1000,
				sort: 'name',
			});
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- casting untyped API response docs
			const docs = result.docs as Array<Record<string, unknown>>;
			const folders = docs.map((d) => ({
				id: String(d['id']),
				name: String(d['name']),
				parent: typeof d['parent'] === 'string' ? d['parent'] : null,
			}));
			this.allFolders.set(folders);
		} catch {
			// media-organizer plugin may not be installed
		}
	}

	/** Load tags from media-tags collection. */
	private async loadTags(): Promise<void> {
		try {
			const result = await this.api.collection('media-tags').find({
				limit: 1000,
				sort: 'name',
			});
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- casting untyped API response docs
			const docs = result.docs as Array<Record<string, unknown>>;
			const tags = docs.map((d) => ({
				id: String(d['id']),
				name: String(d['name']),
				color: typeof d['color'] === 'string' ? d['color'] : undefined,
			}));
			this.allTags.set(tags);
		} catch {
			// media-organizer plugin may not be installed
		}
	}

	onSearchChange(query: string): void {
		this.searchQuery.set(query);
		this.currentPage.set(1);
	}

	onPageChange(page: number): void {
		this.currentPage.set(page);
	}

	onFolderSelected(folderId: string | null): void {
		this.selectedFolderId.set(folderId);
		this.currentPage.set(1);
	}

	onTagSelectionChanged(tagIds: Set<string>): void {
		this.selectedTagIds.set(tagIds);
		this.currentPage.set(1);
	}

	onFilterChanged(state: MediaFilterState): void {
		this.filterState.set(state);
		this.currentPage.set(1);
	}

	onUploadComplete(): void {
		this.loadMedia(
			this.searchQuery(),
			this.currentPage(),
			this.selectedFolderId(),
			this.selectedTagIds(),
			this.filterState(),
		);
		this.loadFolders();
		this.loadTags();
	}

	async createFolder(): Promise<void> {
		const dialogRef = this.dialog.open<PromptDialog, PromptDialogData, string | undefined>(
			PromptDialog,
			{
				width: '24rem',
				data: { title: 'New Folder', label: 'Folder name', placeholder: 'e.g. Photos' },
			},
		);
		const name = await firstValueFrom(dialogRef.afterClosed);
		if (!name) return;

		try {
			await this.api.collection('media-folders').create({
				name,
				parent: this.selectedFolderId(),
			});
			await this.loadFolders();
			this.toast.success('Folder created', `Created folder "${name}"`);
		} catch (error) {
			console.error('Failed to create folder:', error);
			this.toast.error('Error', 'Failed to create folder');
		}
	}

	async createTag(): Promise<void> {
		const dialogRef = this.dialog.open<PromptDialog, PromptDialogData, string | undefined>(
			PromptDialog,
			{
				width: '24rem',
				data: { title: 'New Tag', label: 'Tag name', placeholder: 'e.g. Featured' },
			},
		);
		const name = await firstValueFrom(dialogRef.afterClosed);
		if (!name) return;

		try {
			await this.api.collection('media-tags').create({ name });
			await this.loadTags();
			this.toast.success('Tag created', `Created tag "${name}"`);
		} catch (error) {
			console.error('Failed to create tag:', error);
			this.toast.error('Error', 'Failed to create tag');
		}
	}

	toggleSelection(media: MediaItem): void {
		const selected = new Set(this.selectedItems());
		if (selected.has(media.id)) {
			selected.delete(media.id);
		} else {
			selected.add(media.id);
		}
		this.selectedItems.set(selected);
	}

	viewMedia(media: MediaItem): void {
		this.document.defaultView?.open(this.getMediaUrl(media), '_blank');
	}

	editMedia(media: MediaItem): void {
		const dialogRef = this.dialog.open<
			MediaEditDialog,
			{
				media: MediaItem;
				imageSizes?: ImageSizeConfig[];
				folders?: Array<{ id: string; name: string }>;
				tags?: Array<{ id: string; name: string; color?: string }>;
			},
			MediaEditResult
		>(MediaEditDialog, {
			data: {
				media,
				imageSizes: this.mediaImageSizes,
				folders: this.allFolders(),
				tags: this.allTags(),
			},
			width: '36rem',
		});

		dialogRef.afterClosed.subscribe((result) => {
			if (result?.updated) {
				this.loadMedia(
					this.searchQuery(),
					this.currentPage(),
					this.selectedFolderId(),
					this.selectedTagIds(),
					this.filterState(),
				);
			}
		});
	}

	async deleteMedia(media: MediaItem): Promise<void> {
		const confirmed = await this.feedback.confirmDelete('Media', media.filename);
		if (!confirmed) return;

		try {
			await this.api.collection('media').delete(media.id);
			this.loadMedia(
				this.searchQuery(),
				this.currentPage(),
				this.selectedFolderId(),
				this.selectedTagIds(),
				this.filterState(),
			);
		} catch (error) {
			console.error('Failed to delete media:', error);
		}
	}

	async deleteSelected(): Promise<void> {
		const count = this.selectedItems().size;
		const confirmed = await this.feedback.confirmBulkDelete('Files', count);
		if (!confirmed) return;

		try {
			const ids = Array.from(this.selectedItems());
			await this.api.collection('media').batchDelete(ids);
			this.selectedItems.set(new Set());
			this.loadMedia(
				this.searchQuery(),
				this.currentPage(),
				this.selectedFolderId(),
				this.selectedTagIds(),
				this.filterState(),
			);
		} catch (error) {
			console.error('Failed to delete media:', error);
		}
	}

	async bulkMoveToFolder(): Promise<void> {
		const folders = this.allFolders();
		if (folders.length === 0) {
			this.toast.error('No folders', 'Create a folder first');
			return;
		}

		const dialogRef = this.dialog.open<SelectDialog, SelectDialogData, string | undefined>(
			SelectDialog,
			{
				width: '24rem',
				data: {
					title: 'Move to Folder',
					label: 'Select folder',
					options: folders,
					confirmText: 'Move',
				},
			},
		);
		const folderId = await firstValueFrom(dialogRef.afterClosed);
		if (!folderId) return;

		const folder = folders.find((f) => f.id === folderId);
		if (!folder) return;

		try {
			const ids = Array.from(this.selectedItems());
			await Promise.all(
				ids.map((id) => this.api.collection('media').update(id, { folder: folder.id })),
			);
			this.selectedItems.set(new Set());
			this.toast.success('Moved', `Moved ${ids.length} file(s) to "${folder.name}"`);
			this.loadMedia(
				this.searchQuery(),
				this.currentPage(),
				this.selectedFolderId(),
				this.selectedTagIds(),
				this.filterState(),
			);
		} catch (error) {
			console.error('Failed to move media:', error);
			this.toast.error('Error', 'Failed to move files');
		}
	}

	async bulkTag(): Promise<void> {
		const tags = this.allTags();
		if (tags.length === 0) {
			this.toast.error('No tags', 'Create a tag first');
			return;
		}

		const dialogRef = this.dialog.open<SelectDialog, SelectDialogData, string | undefined>(
			SelectDialog,
			{
				width: '24rem',
				data: {
					title: 'Add Tag',
					label: 'Select tag',
					options: tags,
					confirmText: 'Add Tag',
				},
			},
		);
		const tagId = await firstValueFrom(dialogRef.afterClosed);
		if (!tagId) return;

		const tag = tags.find((t) => t.id === tagId);
		if (!tag) return;

		try {
			const ids = Array.from(this.selectedItems());
			await Promise.all(
				ids.map(async (id) => {
					const fresh = await this.api.collection('media').findById(id);
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- API returns untyped Record, narrowing required for tag array access
					const freshRecord = fresh as Record<string, unknown>;
					const rawTags = freshRecord?.['tags'];
					const currentTags: string[] = Array.isArray(rawTags)
						? rawTags.filter((t): t is string => typeof t === 'string')
						: [];
					if (!currentTags.includes(tag.id)) {
						await this.api.collection('media').update(id, {
							tags: [...currentTags, tag.id],
						});
					}
				}),
			);
			this.selectedItems.set(new Set());
			this.toast.success('Tagged', `Tagged ${ids.length} file(s) with "${tag.name}"`);
			this.loadMedia(
				this.searchQuery(),
				this.currentPage(),
				this.selectedFolderId(),
				this.selectedTagIds(),
				this.filterState(),
			);
		} catch (error) {
			console.error('Failed to tag media:', error);
			this.toast.error('Error', 'Failed to tag files');
		}
	}

	getMediaUrl(media: MediaItem): string {
		return media.url ?? `/api/media/file/${media.path}`;
	}

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

	/**
	 * Handle file selection from legacy input (still supported as fallback).
	 */
	onFilesSelected(event: Event): void {
		const input = getInputElement(event);
		if (!input) return;
		const files = input.files;
		if (!files || files.length === 0) return;

		const uploads: UploadProgress[] = [];
		for (let i = 0; i < files.length; i++) {
			uploads.push({ status: 'pending', progress: 0, file: files[i] });
		}
		this.activeUploads.set(uploads);

		for (const file of Array.from(files)) {
			const sub = this.uploadService.upload(file).subscribe({
				next: (progress) => {
					this.updateUploadProgress(file, progress);
					if (progress.status === 'complete') {
						this.removeUpload(file);
						this.loadMedia(
							this.searchQuery(),
							this.currentPage(),
							this.selectedFolderId(),
							this.selectedTagIds(),
							this.filterState(),
						);
					} else if (progress.status === 'error') {
						this.removeUpload(file);
						this.toast.error('Upload failed', `Failed to upload ${file.name}: ${progress.error}`);
					}
				},
				error: (err: Error) => {
					this.removeUpload(file);
					this.toast.error('Upload failed', `Failed to upload ${file.name}: ${err.message}`);
				},
			});
			this.uploadSubscriptions.push(sub);
		}
		input.value = '';
	}

	private updateUploadProgress(file: File, progress: UploadProgress): void {
		const uploads = this.activeUploads().map((u) => (u.file === file ? progress : u));
		this.activeUploads.set(uploads);
	}

	private removeUpload(file: File): void {
		const uploads = this.activeUploads().filter((u) => u.file !== file);
		this.activeUploads.set(uploads);
	}
}

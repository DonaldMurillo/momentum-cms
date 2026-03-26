import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
	effect,
} from '@angular/core';
import {
	Button,
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogClose,
	DialogRef,
	DIALOG_DATA,
	Spinner,
	Pagination,
} from '@momentumcms/ui';
import { SearchInput } from '@momentumcms/ui';
import { injectMomentumAPI } from '../../../services/momentum-api.service';
import { MediaPreviewComponent } from '../../../widgets/media-preview/media-preview.component';

/**
 * Media item from the API.
 */
export interface MediaItem {
	id: string;
	filename: string;
	mimeType: string;
	path: string;
	url?: string;
	filesize?: number;
	alt?: string;
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

/** Folder option for navigation. */
interface PickerFolderOption {
	id: string;
	name: string;
}

/** Tag option for filtering. */
interface PickerTagOption {
	id: string;
	name: string;
}

/**
 * Data passed to the MediaPickerDialog.
 */
export interface MediaPickerDialogData {
	/** Allowed MIME types filter */
	mimeTypes?: string[];
	/** Collection to query (default: 'media') */
	relationTo?: string;
	/** Available folders for navigation */
	folders?: PickerFolderOption[];
	/** Available tags for filtering */
	tags?: PickerTagOption[];
}

/**
 * Result returned from the MediaPickerDialog.
 */
export interface MediaPickerResult {
	media: MediaItem | null;
}

/**
 * Dialog for selecting media from the media library.
 */
@Component({
	selector: 'mcms-media-picker-dialog',
	imports: [
		Button,
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		Spinner,
		Pagination,
		MediaPreviewComponent,
		SearchInput,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-dialog>
		<mcms-dialog-header>
			<mcms-dialog-title>Select Media</mcms-dialog-title>
		</mcms-dialog-header>

		<mcms-dialog-content class="max-h-[60vh] overflow-auto">
			<!-- Search -->
			<div class="mb-4 space-y-2">
				<mcms-search-input
					placeholder="Search media..."
					[value]="searchQuery()"
					(valueChange)="onSearchChange($event)"
				/>

				@if (folderOptions.length > 0) {
					<div class="flex items-center gap-2">
						<span class="text-xs text-mcms-muted-foreground">Folder:</span>
						<select
							class="rounded-md border border-mcms-border bg-transparent px-2 py-1 text-xs"
							[value]="selectedFolderId() ?? ''"
							(change)="onFolderChange($event)"
						>
							<option value="">All</option>
							@for (folder of folderOptions; track folder.id) {
								<option [value]="folder.id">{{ folder.name }}</option>
							}
						</select>
					</div>
				}

				@if (tagOptions.length > 0) {
					<div class="flex flex-wrap items-center gap-1">
						<span class="text-xs text-mcms-muted-foreground">Tags:</span>
						@for (tag of tagOptions; track tag.id) {
							<button
								type="button"
								class="rounded-full border px-2 py-0.5 text-xs transition-colors"
								[class.bg-mcms-primary]="selectedTagIds().has(tag.id)"
								[class.text-mcms-primary-foreground]="selectedTagIds().has(tag.id)"
								[class.border-mcms-primary]="selectedTagIds().has(tag.id)"
								[class.border-mcms-border]="!selectedTagIds().has(tag.id)"
								(click)="toggleTag(tag.id)"
							>
								{{ tag.name }}
							</button>
						}
					</div>
				}
			</div>

			@if (isLoading()) {
				<div class="flex h-48 items-center justify-center">
					<mcms-spinner size="lg" />
				</div>
			} @else if (mediaItems().length === 0) {
				<div class="flex h-48 flex-col items-center justify-center text-mcms-muted-foreground">
					<p class="text-sm">No media found</p>
					@if (searchQuery()) {
						<p class="text-xs">Try a different search term</p>
					}
				</div>
			} @else {
				<!-- Media grid -->
				<div class="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
					@for (media of mediaItems(); track media.id) {
						<button
							type="button"
							class="group relative overflow-hidden rounded-lg border-2 transition-all hover:border-mcms-primary"
							[class.border-mcms-primary]="selectedMedia()?.id === media.id"
							[class.border-transparent]="selectedMedia()?.id !== media.id"
							[class.ring-2]="selectedMedia()?.id === media.id"
							[class.ring-mcms-primary/50]="selectedMedia()?.id === media.id"
							(click)="selectMedia(media)"
							(dblclick)="confirmSelection(media)"
							[attr.aria-label]="'Select ' + media.filename"
							[attr.aria-pressed]="selectedMedia()?.id === media.id"
						>
							<mcms-media-preview
								[media]="media"
								size="xl"
								[rounded]="false"
								class="aspect-square w-full"
							/>
							<div
								class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<p class="truncate text-xs text-white">{{ media.filename }}</p>
							</div>
						</button>
					}
				</div>

				<!-- Pagination -->
				@if (totalPages() > 1) {
					<div class="mt-4 flex justify-center">
						<mcms-pagination
							[currentPage]="currentPage()"
							[totalPages]="totalPages()"
							(pageChange)="onPageChange($event)"
						/>
					</div>
				}
			}
		</mcms-dialog-content>

		<mcms-dialog-footer>
			<button mcms-button variant="outline" mcmsDialogClose type="button">Cancel</button>
			<button
				mcms-button
				type="button"
				[disabled]="!selectedMedia()"
				(click)="confirm()"
			>
				Select
			</button>
		</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class MediaPickerDialog {
	private readonly dialogRef = inject(DialogRef<MediaPickerResult>);
	private readonly data = inject<MediaPickerDialogData>(DIALOG_DATA);
	private readonly api = injectMomentumAPI();

	/** Internal state */
	readonly isLoading = signal(true);
	readonly mediaItems = signal<MediaItem[]>([]);
	readonly selectedMedia = signal<MediaItem | null>(null);
	readonly searchQuery = signal('');
	readonly currentPage = signal(1);
	readonly totalPages = signal(1);
	readonly totalDocs = signal(0);
	readonly limit = signal(24);
	readonly selectedFolderId = signal<string | null>(null);
	readonly selectedTagIds = signal<Set<string>>(new Set());

	/** Collection to query */
	readonly collectionSlug = computed(() => this.data?.relationTo ?? 'media');
	readonly folderOptions = this.data?.folders ?? [];
	readonly tagOptions = this.data?.tags ?? [];

	constructor() {
		// Load media on init and when search/page/folder/tag changes
		effect(() => {
			const query = this.searchQuery();
			const page = this.currentPage();
			// Track folder/tag signals so the effect re-runs when they change
			this.selectedFolderId();
			this.selectedTagIds();
			this.loadMedia(query, page);
		});
	}

	/**
	 * Load media from the API.
	 */
	private async loadMedia(search: string, page: number): Promise<void> {
		this.isLoading.set(true);

		try {
			const collection = this.api.collection(this.collectionSlug());

			const where: Record<string, unknown> = {};
			const folderId = this.selectedFolderId();
			const tagIds = this.selectedTagIds();
			if (folderId) where['folder'] = { equals: folderId };
			if (tagIds.size > 0) where['tags'] = { in: Array.from(tagIds) };

			// Server-side search filter (filename contains search term)
			if (search) {
				where['filename'] = { contains: search };
			}

			// Server-side MIME type filter
			const mimeTypes = this.data?.mimeTypes;
			if (mimeTypes && mimeTypes.length > 0) {
				const exactTypes = mimeTypes.filter((p) => !p.endsWith('/*'));
				const wildcardPrefixes = mimeTypes
					.filter((p) => p.endsWith('/*'))
					.map((p) => p.slice(0, -1));

				const mimeConditions: Record<string, unknown>[] = [];
				if (exactTypes.length > 0) {
					mimeConditions.push({ mimeType: { in: exactTypes } });
				}
				for (const prefix of wildcardPrefixes) {
					mimeConditions.push({ mimeType: { like: `${prefix}%` } });
				}
				if (mimeConditions.length > 0) {
					where['$or'] = mimeConditions;
				}
			}

			const result = await collection.find({
				page,
				limit: this.limit(),
				where: Object.keys(where).length > 0 ? where : undefined,
			});

			const items = toMediaItems(result.docs);
			this.mediaItems.set(items);
			this.totalDocs.set(result.totalDocs);
			this.totalPages.set(result.totalPages);
		} catch (error) {
			console.error('Failed to load media:', error);
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

	onFolderChange(event: Event): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DOM event target narrowing
		const select = event.target as HTMLSelectElement;
		this.selectedFolderId.set(select.value || null);
		this.currentPage.set(1);
	}

	toggleTag(tagId: string): void {
		const ids = new Set(this.selectedTagIds());
		if (ids.has(tagId)) {
			ids.delete(tagId);
		} else {
			ids.add(tagId);
		}
		this.selectedTagIds.set(ids);
		this.currentPage.set(1);
	}

	/**
	 * Handle page change.
	 */
	onPageChange(page: number): void {
		this.currentPage.set(page);
	}

	/**
	 * Select a media item.
	 */
	selectMedia(media: MediaItem): void {
		this.selectedMedia.set(media);
	}

	/**
	 * Confirm selection on double-click.
	 */
	confirmSelection(media: MediaItem): void {
		this.selectedMedia.set(media);
		this.confirm();
	}

	/**
	 * Confirm and close dialog.
	 */
	confirm(): void {
		const selected = this.selectedMedia();
		if (selected) {
			this.dialogRef.close({ media: selected });
		}
	}
}

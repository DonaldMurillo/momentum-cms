import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
	Input,
	Textarea,
	Label,
	Spinner,
	Alert,
} from '@momentum-cms/ui';
import { injectMomentumAPI } from '../../services/momentum-api.service';
import { MediaPreviewComponent } from '../media-preview/media-preview.component';

/** Media item shape passed to the dialog. */
export interface MediaEditItem {
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

/** Data passed to the MediaEditDialog. */
export interface MediaEditDialogData {
	media: MediaEditItem;
}

/** Result returned when the dialog closes. */
export interface MediaEditResult {
	updated: boolean;
	media?: MediaEditItem;
}

/**
 * Type guard to check if a value has the shape of a MediaEditItem.
 */
function isMediaEditItem(value: unknown): value is MediaEditItem {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions
	return (
		typeof obj['id'] === 'string' &&
		typeof obj['filename'] === 'string' &&
		typeof obj['mimeType'] === 'string' &&
		typeof obj['path'] === 'string'
	);
}

/**
 * Format file size in human-readable form.
 */
function formatFileSize(bytes?: number): string {
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
 * Dialog for editing media metadata (filename, alt text).
 */
@Component({
	selector: 'mcms-media-edit-dialog',
	imports: [
		Button,
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		Input,
		Textarea,
		Label,
		Spinner,
		Alert,
		MediaPreviewComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { style: 'display: block; width: 100%' },
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>Edit Media</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<div class="flex gap-6">
					<!-- Preview -->
					<div class="shrink-0">
						<mcms-media-preview [media]="media" size="lg" />
					</div>

					<!-- Form -->
					<div class="flex-1 space-y-4">
						<div class="space-y-2">
							<mcms-label for="media-filename">Filename</mcms-label>
							<mcms-input id="media-filename" [(value)]="filename" placeholder="File name" />
						</div>

						<div class="space-y-2">
							<mcms-label for="media-alt">Alt Text</mcms-label>
							<mcms-textarea
								id="media-alt"
								[(value)]="altText"
								placeholder="Describe this media for accessibility"
								[rows]="3"
							/>
						</div>

						<!-- Read-only info -->
						<div class="space-y-1 text-sm text-muted-foreground">
							<p>Type: {{ media.mimeType }}</p>
							<p>Size: {{ formattedSize }}</p>
							@if (media.width && media.height) {
								<p>Dimensions: {{ media.width }} x {{ media.height }}</p>
							}
						</div>
					</div>
				</div>

				@if (saveError()) {
					<mcms-alert variant="destructive" class="mt-4">
						{{ saveError() }}
					</mcms-alert>
				}
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button mcms-button variant="outline" mcmsDialogClose type="button">Cancel</button>
				<button mcms-button type="button" [disabled]="isSaving() || !hasChanges()" (click)="save()">
					@if (isSaving()) {
						<mcms-spinner size="sm" />
					}
					Save Changes
				</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class MediaEditDialog {
	private readonly dialogRef = inject(DialogRef<MediaEditResult>);
	private readonly data = inject<MediaEditDialogData>(DIALOG_DATA);
	private readonly api = injectMomentumAPI();

	readonly media = this.data.media;
	readonly filename = signal(this.data.media.filename);
	readonly altText = signal(this.data.media.alt ?? '');
	readonly isSaving = signal(false);
	readonly saveError = signal<string | null>(null);
	readonly formattedSize = formatFileSize(this.data.media.filesize);

	readonly hasChanges = computed(() => {
		return this.filename() !== this.media.filename || this.altText() !== (this.media.alt ?? '');
	});

	/**
	 * Save media metadata changes via API.
	 */
	async save(): Promise<void> {
		this.isSaving.set(true);
		this.saveError.set(null);

		try {
			const result = await this.api.collection('media').update(this.media.id, {
				filename: this.filename(),
				alt: this.altText(),
			});

			if (isMediaEditItem(result)) {
				this.dialogRef.close({ updated: true, media: result });
			} else {
				this.dialogRef.close({ updated: true });
			}
		} catch (err) {
			this.saveError.set(err instanceof Error ? err.message : 'Failed to save changes');
		} finally {
			this.isSaving.set(false);
		}
	}
}

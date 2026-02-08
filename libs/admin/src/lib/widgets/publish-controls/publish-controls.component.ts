import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { Badge, Button } from '@momentum-cms/ui';
import { VersionService, type DocumentStatus } from '../../services/version.service';
import { FeedbackService } from '../feedback/feedback.service';

/**
 * Publish Controls Widget
 *
 * Displays the current document status and provides publish/unpublish actions.
 *
 * @example
 * ```html
 * <mcms-publish-controls
 *   [collection]="'posts'"
 *   [documentId]="'abc123'"
 *   [documentLabel]="'Post'"
 *   (statusChanged)="onStatusChanged($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-publish-controls',
	imports: [Badge, Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'inline-flex items-center gap-3' },
	template: `
		<mcms-badge [variant]="statusVariant()">
			{{ statusLabel() }}
		</mcms-badge>

		@if (status() === 'draft') {
			<button
				mcms-button
				variant="primary"
				size="sm"
				[disabled]="isUpdating()"
				(click)="onPublish()"
			>
				@if (isUpdating()) {
					Publishing...
				} @else {
					Publish
				}
			</button>
		} @else {
			<button
				mcms-button
				variant="outline"
				size="sm"
				[disabled]="isUpdating()"
				(click)="onUnpublish()"
			>
				@if (isUpdating()) {
					Unpublishing...
				} @else {
					Unpublish
				}
			</button>
		}
	`,
})
export class PublishControlsWidget {
	private readonly versionService = inject(VersionService);
	private readonly feedback = inject(FeedbackService);

	/** Collection slug */
	readonly collection = input.required<string>();

	/** Document ID */
	readonly documentId = input.required<string>();

	/** Document label for feedback messages */
	readonly documentLabel = input('Document');

	/** Initial status (optional, will be fetched if not provided) */
	readonly initialStatus = input<DocumentStatus | undefined>(undefined);

	/** Emitted when the status changes */
	readonly statusChanged = output<DocumentStatus>();

	/** Current status */
	readonly status = signal<DocumentStatus>('draft');

	/** Whether a status update is in progress */
	readonly isUpdating = signal(false);

	/** Whether status is loading */
	readonly isLoading = signal(false);

	/** Badge variant based on status (derived from status signal) */
	readonly statusVariant = computed<'default' | 'secondary' | 'outline'>(() =>
		this.status() === 'published' ? 'default' : 'secondary',
	);

	/** Status label (derived from status signal) */
	readonly statusLabel = computed(() => (this.status() === 'published' ? 'Published' : 'Draft'));

	constructor() {
		// Load status when inputs change
		effect(() => {
			const collection = this.collection();
			const docId = this.documentId();
			const initial = this.initialStatus();

			if (initial !== undefined) {
				this.updateStatusDisplay(initial);
			} else if (collection && docId) {
				this.loadStatus(collection, docId);
			}
		});
	}

	/**
	 * Load the current status from the API.
	 */
	private async loadStatus(collection: string, docId: string): Promise<void> {
		this.isLoading.set(true);

		try {
			const status = await this.versionService.getStatus(collection, docId);
			this.updateStatusDisplay(status);
		} catch {
			// Default to draft if we can't load status
			this.updateStatusDisplay('draft');
		} finally {
			this.isLoading.set(false);
		}
	}

	/**
	 * Update the status display.
	 * statusVariant and statusLabel are computed signals that automatically update.
	 */
	private updateStatusDisplay(status: DocumentStatus): void {
		this.status.set(status);
	}

	/**
	 * Publish the document.
	 */
	async onPublish(): Promise<void> {
		this.isUpdating.set(true);

		try {
			await this.versionService.publish(this.collection(), this.documentId());
			this.updateStatusDisplay('published');
			this.statusChanged.emit('published');
		} catch {
			// Error handled by crudToastInterceptor
		} finally {
			this.isUpdating.set(false);
		}
	}

	/**
	 * Unpublish the document.
	 */
	async onUnpublish(): Promise<void> {
		const confirmed = await this.feedback.confirmUnpublish(this.documentLabel());

		if (!confirmed) {
			return;
		}

		this.isUpdating.set(true);

		try {
			await this.versionService.unpublish(this.collection(), this.documentId());
			this.updateStatusDisplay('draft');
			this.statusChanged.emit('draft');
		} catch {
			// Error handled by crudToastInterceptor
		} finally {
			this.isUpdating.set(false);
		}
	}
}

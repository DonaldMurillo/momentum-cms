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
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Badge, Button, DialogService } from '@momentumcms/ui';
import { VersionService, type DocumentStatus } from '../../services/version.service';
import { FeedbackService } from '../feedback/feedback.service';
import {
	SchedulePublishDialogComponent,
	type SchedulePublishDialogData,
	type SchedulePublishDialogResult,
} from './schedule-publish-dialog.component';

/**
 * Publish Controls Widget
 *
 * Displays the current document status and provides publish/unpublish actions.
 * For draft documents, also exposes Schedule Publish (opens a dialog) and,
 * when a publish is scheduled, a "Scheduled for X" badge with a Cancel button.
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
	imports: [DatePipe, Badge, Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'inline-flex items-center gap-3 flex-wrap',
		role: 'status',
		'aria-live': 'polite',
		'aria-label': 'Publish status',
	},
	template: `
		<mcms-badge [variant]="statusVariant()">
			{{ statusLabel() }}
		</mcms-badge>

		@if (status() === 'draft' && !scheduledPublishAt()) {
			<button
				mcms-button
				variant="primary"
				size="sm"
				[disabled]="isUpdating()"
				[attr.aria-busy]="isUpdating() ? 'true' : null"
				data-testid="publish-button"
				(click)="onPublish()"
			>
				@if (isUpdating()) {
					Publishing...
				} @else {
					Publish
				}
			</button>
			<button
				mcms-button
				variant="outline"
				size="sm"
				[disabled]="isUpdating()"
				data-testid="schedule-publish-button"
				(click)="onOpenSchedule()"
			>
				Schedule
			</button>
		} @else if (scheduledPublishAt()) {
			<mcms-badge variant="outline" data-testid="scheduled-badge">
				Scheduled for {{ scheduledPublishAt() | date: 'medium' }}
			</mcms-badge>
			<button
				mcms-button
				variant="outline"
				size="sm"
				[disabled]="isUpdating()"
				[attr.aria-busy]="isUpdating() ? 'true' : null"
				data-testid="cancel-schedule-button"
				(click)="onCancelSchedule()"
			>
				Cancel schedule
			</button>
		} @else {
			<button
				mcms-button
				variant="outline"
				size="sm"
				[disabled]="isUpdating()"
				[attr.aria-busy]="isUpdating() ? 'true' : null"
				data-testid="unpublish-button"
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
	private readonly dialogService = inject(DialogService);

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

	/**
	 * Emitted after any successful publish/unpublish/schedule/cancel action.
	 * The parent uses this to refresh related widgets (version history, etc.)
	 * even when the status itself didn't flip (schedule and cancel-schedule
	 * leave `status` as 'draft').
	 */
	readonly actionPerformed = output<'publish' | 'unpublish' | 'schedule' | 'cancel-schedule'>();

	/** Current status */
	readonly status = signal<DocumentStatus>('draft');

	/** Currently scheduled publish ISO timestamp, or null when not scheduled. */
	readonly scheduledPublishAt = signal<string | null>(null);

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
				this.status.set(initial);
			}

			if (collection && docId) {
				this.refreshState(collection, docId, initial === undefined);
			}
		});
	}

	/**
	 * Load the current status (and scheduled publish timestamp) from the API.
	 */
	private async refreshState(
		collection: string,
		docId: string,
		fetchStatus: boolean,
	): Promise<void> {
		this.isLoading.set(true);

		try {
			const [status, scheduledPublishAt] = await Promise.all([
				fetchStatus
					? this.versionService.getStatus(collection, docId).catch(() => 'draft' as const)
					: Promise.resolve(this.status()),
				this.versionService.getScheduledPublishAt(collection, docId).catch(() => null),
			]);
			this.status.set(status);
			this.scheduledPublishAt.set(scheduledPublishAt);
		} finally {
			this.isLoading.set(false);
		}
	}

	/**
	 * Publish the document.
	 */
	async onPublish(): Promise<void> {
		this.isUpdating.set(true);

		try {
			await this.versionService.publish(this.collection(), this.documentId());
			this.status.set('published');
			this.scheduledPublishAt.set(null);
			this.statusChanged.emit('published');
			this.actionPerformed.emit('publish');
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
			this.status.set('draft');
			this.statusChanged.emit('draft');
			this.actionPerformed.emit('unpublish');
		} catch {
			// Error handled by crudToastInterceptor
		} finally {
			this.isUpdating.set(false);
		}
	}

	/**
	 * Open the schedule-publish dialog and persist the chosen date.
	 */
	async onOpenSchedule(): Promise<void> {
		const data: SchedulePublishDialogData = {
			collectionLabel: this.documentLabel(),
		};
		const ref = this.dialogService.open<
			SchedulePublishDialogComponent,
			SchedulePublishDialogData,
			SchedulePublishDialogResult
		>(SchedulePublishDialogComponent, { data, width: '28rem' });

		const result = await firstValueFrom(ref.afterClosed);

		if (!result) return;

		this.isUpdating.set(true);
		try {
			await this.versionService.schedulePublish(this.collection(), this.documentId(), result);
			this.scheduledPublishAt.set(result);
			this.feedback.publishScheduled(this.documentLabel(), new Date(result));
			this.actionPerformed.emit('schedule');
		} catch (err) {
			this.feedback.operationFailed(
				'Could not schedule publish',
				err instanceof Error ? err : undefined,
			);
		} finally {
			this.isUpdating.set(false);
		}
	}

	/**
	 * Cancel a previously scheduled publish (with confirm).
	 */
	async onCancelSchedule(): Promise<void> {
		const confirmed = await this.feedback.confirmCancelSchedule(this.documentLabel());
		if (!confirmed) return;

		this.isUpdating.set(true);
		try {
			await this.versionService.cancelScheduledPublish(this.collection(), this.documentId());
			this.scheduledPublishAt.set(null);
			this.feedback.scheduledPublishCancelled(this.documentLabel());
			this.actionPerformed.emit('cancel-schedule');
		} catch (err) {
			this.feedback.operationFailed(
				'Could not cancel scheduled publish',
				err instanceof Error ? err : undefined,
			);
		} finally {
			this.isUpdating.set(false);
		}
	}
}

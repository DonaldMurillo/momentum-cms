import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
	Badge,
	Button,
	Skeleton,
	Card,
	CardHeader,
	CardContent,
	Separator,
	DialogService,
} from '@momentum-cms/ui';
import {
	VersionService,
	type DocumentVersionParsed,
	type DocumentStatus,
} from '../../services/version.service';
import { FeedbackService } from '../feedback/feedback.service';
import {
	VersionDiffDialogComponent,
	type VersionDiffDialogData,
} from './version-diff-dialog.component';

/**
 * Version History Widget
 *
 * Displays a list of document versions with the ability to restore previous versions.
 *
 * @example
 * ```html
 * <mcms-version-history
 *   [collection]="'posts'"
 *   [documentId]="'abc123'"
 *   [documentLabel]="'Post'"
 *   (restored)="onVersionRestored($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-version-history',
	imports: [DatePipe, Badge, Button, Skeleton, Card, CardHeader, CardContent, Separator],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<mcms-card>
			<mcms-card-header>
				<div class="flex items-center justify-between">
					<h3 class="font-semibold">Version History</h3>
					@if (versions().length > 0) {
						<mcms-badge variant="secondary">{{ versions().length }}</mcms-badge>
					}
				</div>
			</mcms-card-header>

			<mcms-card-content class="space-y-3">
				@if (isLoading()) {
					<div class="space-y-3">
						@for (i of [1, 2, 3]; track i) {
							<mcms-skeleton class="h-16 w-full" />
						}
					</div>
				} @else if (error()) {
					<p class="text-sm text-destructive">{{ error() }}</p>
				} @else if (versions().length === 0) {
					<p class="text-sm text-muted-foreground">No version history available</p>
				} @else {
					@for (version of versions(); track version.id; let first = $first) {
						@if (!first) {
							<mcms-separator />
						}
						<div class="flex items-center justify-between py-2">
							<div class="flex flex-col gap-1">
								<div class="flex items-center gap-2">
									<mcms-badge [variant]="getStatusVariant(version._status)">
										{{ version._status }}
									</mcms-badge>
									@if (version.autosave) {
										<mcms-badge variant="outline">autosave</mcms-badge>
									}
									@if (first) {
										<mcms-badge variant="secondary">current</mcms-badge>
									}
								</div>
								<span class="text-sm text-muted-foreground">
									{{ version.createdAt | date: 'medium' }}
								</span>
							</div>
							@if (!first) {
								<div class="flex items-center gap-1">
									<button
										mcms-button
										variant="ghost"
										size="sm"
										title="Compare with current version"
										aria-label="Compare with current version"
										(click)="onCompare(version)"
									>
										Compare
									</button>
									<button
										mcms-button
										variant="outline"
										size="sm"
										[disabled]="isRestoring()"
										(click)="onRestore(version)"
									>
										@if (isRestoring() && restoringVersionId() === version.id) {
											Restoring...
										} @else {
											Restore
										}
									</button>
								</div>
							}
						</div>
					}
				}

				@if (hasNextPage()) {
					<div class="pt-2">
						<button
							mcms-button
							variant="ghost"
							size="sm"
							class="w-full"
							[disabled]="isLoadingMore()"
							(click)="loadMore()"
						>
							@if (isLoadingMore()) {
								Loading...
							} @else {
								Load more
							}
						</button>
					</div>
				}
			</mcms-card-content>
		</mcms-card>
	`,
})
export class VersionHistoryWidget {
	private readonly versionService = inject(VersionService);
	private readonly feedback = inject(FeedbackService);
	private readonly dialogService = inject(DialogService);

	/** Collection slug */
	readonly collection = input.required<string>();

	/** Document ID */
	readonly documentId = input.required<string>();

	/** Document label for feedback messages */
	readonly documentLabel = input('Document');

	/** Emitted when a version is restored */
	readonly restored = output<DocumentVersionParsed>();

	/** Versions list */
	readonly versions = signal<DocumentVersionParsed[]>([]);

	/** Whether versions are loading */
	readonly isLoading = signal(true);

	/** Whether more versions are loading */
	readonly isLoadingMore = signal(false);

	/** Whether a restore is in progress */
	readonly isRestoring = signal(false);

	/** ID of the version being restored */
	readonly restoringVersionId = signal<string | null>(null);

	/** Error message */
	readonly error = signal<string | null>(null);

	/** Current page */
	readonly currentPage = signal(1);

	/** Whether there are more versions */
	readonly hasNextPage = signal(false);

	constructor() {
		// Load versions when inputs change
		effect(() => {
			const collection = this.collection();
			const docId = this.documentId();

			if (collection && docId) {
				this.loadVersions(collection, docId, 1);
			}
		});
	}

	/**
	 * Load versions from the API.
	 */
	private async loadVersions(
		collection: string,
		docId: string,
		page: number,
		append = false,
	): Promise<void> {
		if (page === 1) {
			this.isLoading.set(true);
		} else {
			this.isLoadingMore.set(true);
		}
		this.error.set(null);

		try {
			const result = await this.versionService.findVersions(collection, docId, {
				limit: 10,
				page,
				includeAutosave: true,
			});

			if (append) {
				this.versions.update((current) => [...current, ...result.docs]);
			} else {
				this.versions.set(result.docs);
			}

			this.currentPage.set(page);
			this.hasNextPage.set(result.hasNextPage);
		} catch {
			this.error.set('Failed to load version history');
		} finally {
			this.isLoading.set(false);
			this.isLoadingMore.set(false);
		}
	}

	/**
	 * Load more versions.
	 */
	loadMore(): void {
		const nextPage = this.currentPage() + 1;
		this.loadVersions(this.collection(), this.documentId(), nextPage, true);
	}

	/**
	 * Restore a version.
	 */
	async onRestore(version: DocumentVersionParsed): Promise<void> {
		const confirmed = await this.feedback.confirmRestore(this.documentLabel());

		if (!confirmed) {
			return;
		}

		this.isRestoring.set(true);
		this.restoringVersionId.set(version.id);

		try {
			await this.versionService.restore(this.collection(), this.documentId(), {
				versionId: version.id,
			});

			this.feedback.versionRestored(this.documentLabel());
			this.restored.emit(version);

			// Reload versions to show the new state
			this.loadVersions(this.collection(), this.documentId(), 1);
		} catch (err) {
			const error = err instanceof Error ? err : new Error('Could not restore to selected version');
			this.feedback.operationFailed('Restore failed', error);
		} finally {
			this.isRestoring.set(false);
			this.restoringVersionId.set(null);
		}
	}

	/**
	 * Compare a version with the current (most recent) version.
	 */
	onCompare(version: DocumentVersionParsed): void {
		const current = this.versions()[0];
		if (!current) return;

		const data: VersionDiffDialogData = {
			collection: this.collection(),
			documentId: this.documentId(),
			versionId1: version.id,
			versionId2: current.id,
			label1: new Date(version.createdAt).toLocaleString(),
			label2: 'Current',
		};

		this.dialogService.open(VersionDiffDialogComponent, {
			data,
			width: '40rem',
		});
	}

	/**
	 * Get badge variant for status.
	 */
	getStatusVariant(status: DocumentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
		return status === 'published' ? 'default' : 'secondary';
	}
}

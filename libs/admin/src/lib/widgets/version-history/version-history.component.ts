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
	DialogService,
} from '@momentumcms/ui';
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
 * Displays a visual timeline of document versions with the ability to
 * restore previous versions and compare any two versions.
 */
@Component({
	selector: 'mcms-version-history',
	imports: [DatePipe, Badge, Button, Skeleton, Card, CardHeader, CardContent],
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

			<mcms-card-content class="space-y-0">
				@if (isLoading()) {
					<div class="space-y-3">
						@for (i of [1, 2, 3]; track i) {
							<mcms-skeleton class="h-16 w-full" />
						}
					</div>
				} @else if (error()) {
					<p class="text-sm text-destructive" role="alert">{{ error() }}</p>
				} @else if (versions().length === 0) {
					<p class="text-sm text-muted-foreground">No version history available</p>
				} @else {
					@for (version of versions(); track version.id; let first = $first; let last = $last) {
						<div class="flex gap-3" data-testid="version-timeline-item">
							<!-- Timeline indicator -->
							<div class="flex flex-col items-center pt-3">
								<div
									class="rounded-full border-2"
									[class]="getTimelineDotClass(version, first)"
									data-testid="timeline-dot"
									[attr.data-status]="version._status"
									[attr.data-current]="first"
									[attr.data-autosave]="version.autosave"
								></div>
								@if (!last) {
									<div class="w-px flex-1 bg-border min-h-4"></div>
								}
							</div>

							<!-- Version content -->
							<div class="flex flex-1 items-center justify-between py-2">
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
								<div class="flex items-center gap-1">
									<button
										mcms-button
										variant="ghost"
										size="sm"
										title="Compare with current document"
										aria-label="Compare with current document"
										(click)="onCompare(version)"
									>
										Compare
									</button>
									@if (!first) {
										<button
											mcms-button
											variant="outline"
											size="sm"
											[disabled]="isRestoring()"
											[attr.aria-label]="
												'Restore version from ' + (version.createdAt | date: 'medium')
											"
											(click)="onRestore(version)"
										>
											@if (isRestoring() && restoringVersionId() === version.id) {
												Restoring...
											} @else {
												Restore
											}
										</button>
									}
								</div>
							</div>
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

	/**
	 * Bump this number from the parent to force a fresh fetch of versions.
	 * Lets external actions (save-draft, schedule-publish, manual publish) keep
	 * the timeline in sync without a hard navigation.
	 */
	readonly reloadKey = input(0);

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
		// Load versions when inputs change. Reading reloadKey() makes this
		// effect re-run whenever the parent bumps the counter to request a
		// fresh fetch (e.g. after save-draft, publish, schedule).
		effect(() => {
			const collection = this.collection();
			const docId = this.documentId();
			this.reloadKey();

			if (collection && docId) {
				this.loadVersions(collection, docId, 1);
			}
		});
	}

	/**
	 * Get CSS classes for the timeline dot based on version status.
	 */
	getTimelineDotClass(version: DocumentVersionParsed, isCurrent: boolean): string {
		const base = isCurrent ? 'h-3.5 w-3.5' : version.autosave ? 'h-2 w-2' : 'h-3 w-3';

		if (isCurrent) {
			return `${base} border-primary bg-primary ring-2 ring-primary/20`;
		}
		if (version._status === 'published') {
			return `${base} border-primary bg-primary`;
		}
		// Draft: hollow
		return `${base} border-muted-foreground bg-background`;
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
	 * Compare a version against the current live document.
	 * Uses "current" as a special version ID that the server resolves
	 * to the live document data.
	 */
	onCompare(version: DocumentVersionParsed): void {
		const data: VersionDiffDialogData = {
			collection: this.collection(),
			documentId: this.documentId(),
			versionId1: version.id,
			versionId2: 'current',
			label1: new Date(version.createdAt).toLocaleString(),
			label2: 'Current',
			versions: this.versions(),
		};

		this.dialogService.open(VersionDiffDialogComponent, {
			data,
			width: '56rem',
		});
	}

	/**
	 * Get badge variant for status.
	 */
	getStatusVariant(status: DocumentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
		return status === 'published' ? 'default' : 'secondary';
	}
}

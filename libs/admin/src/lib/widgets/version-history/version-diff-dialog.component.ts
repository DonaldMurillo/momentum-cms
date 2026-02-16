import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogClose,
	Button,
	Badge,
	Skeleton,
	DIALOG_DATA,
} from '@momentumcms/ui';
import { VersionService, type VersionFieldDiff } from '../../services/version.service';

/**
 * Data passed to the version diff dialog.
 */
export interface VersionDiffDialogData {
	collection: string;
	documentId: string;
	versionId1: string;
	versionId2: string;
	label1: string;
	label2: string;
}

/**
 * Dialog component for displaying field-by-field differences between two versions.
 */
@Component({
	selector: 'mcms-version-diff-dialog',
	imports: [
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		Button,
		Badge,
		Skeleton,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>Compare Versions</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				@if (isLoading()) {
					<div class="space-y-4">
						@for (i of [1, 2, 3]; track i) {
							<mcms-skeleton class="h-20 w-full" />
						}
					</div>
				} @else if (error()) {
					<p class="text-sm text-destructive">{{ error() }}</p>
				} @else if (differences().length === 0) {
					<p class="text-sm text-muted-foreground">No differences found between these versions.</p>
				} @else {
					<div class="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
						<span class="flex items-center gap-1">
							<span class="inline-block h-3 w-3 rounded bg-red-100 dark:bg-red-900/30"></span>
							{{ data.label1 }} (old)
						</span>
						<span class="flex items-center gap-1">
							<span class="inline-block h-3 w-3 rounded bg-green-100 dark:bg-green-900/30"></span>
							{{ data.label2 }} (new)
						</span>
					</div>

					<div class="space-y-3">
						@for (diff of differences(); track diff.field) {
							<div class="rounded-md border border-border p-3">
								<div class="mb-2 flex items-center gap-2">
									<mcms-badge variant="outline">{{ diff.field }}</mcms-badge>
									@if (diff.oldValue === undefined || diff.oldValue === null) {
										<mcms-badge variant="default" class="text-xs">added</mcms-badge>
									} @else if (diff.newValue === undefined || diff.newValue === null) {
										<mcms-badge variant="destructive" class="text-xs">removed</mcms-badge>
									} @else {
										<mcms-badge variant="secondary" class="text-xs">changed</mcms-badge>
									}
								</div>
								<div class="space-y-1 text-sm">
									@if (diff.oldValue !== undefined && diff.oldValue !== null) {
										<div
											class="rounded bg-red-50 px-2 py-1 dark:bg-red-900/20"
											data-testid="diff-old-value"
										>
											<span class="text-muted-foreground">-&nbsp;</span>
											<span class="break-all">{{ formatValue(diff.oldValue) }}</span>
										</div>
									}
									@if (diff.newValue !== undefined && diff.newValue !== null) {
										<div
											class="rounded bg-green-50 px-2 py-1 dark:bg-green-900/20"
											data-testid="diff-new-value"
										>
											<span class="text-muted-foreground">+&nbsp;</span>
											<span class="break-all">{{ formatValue(diff.newValue) }}</span>
										</div>
									}
								</div>
							</div>
						}
					</div>
				}
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button mcms-button variant="outline" [mcmsDialogClose]>Close</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class VersionDiffDialogComponent {
	readonly data = inject<VersionDiffDialogData>(DIALOG_DATA);
	private readonly versionService = inject(VersionService);

	readonly isLoading = signal(true);
	readonly error = signal<string | null>(null);
	readonly differences = signal<VersionFieldDiff[]>([]);

	constructor() {
		this.loadDifferences();
	}

	private async loadDifferences(): Promise<void> {
		try {
			const diffs = await this.versionService.compareVersions(
				this.data.collection,
				this.data.documentId,
				this.data.versionId1,
				this.data.versionId2,
			);
			this.differences.set(diffs);
		} catch {
			this.error.set('Failed to compare versions');
		} finally {
			this.isLoading.set(false);
		}
	}

	/**
	 * Format a value for display.
	 */
	formatValue(value: unknown): string {
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		return JSON.stringify(value, null, 2);
	}
}

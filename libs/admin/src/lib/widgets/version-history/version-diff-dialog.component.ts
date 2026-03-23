import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogClose,
	Button,
	Skeleton,
	DIALOG_DATA,
} from '@momentumcms/ui';
import type { DeepDiffResult } from '@momentumcms/core';
import { VersionService, type DocumentVersionParsed } from '../../services/version.service';
import { DiffFieldRendererComponent } from './diff-field-renderer.component';

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
	/** Full versions list for the version selectors */
	versions: DocumentVersionParsed[];
}

/**
 * Enhanced version diff dialog with:
 * - Version selectors (pick any two versions)
 * - Inline / side-by-side view mode tabs
 * - Prev/Next navigation through version pairs
 * - Summary bar (added/removed/changed counts)
 * - Show only changes filter
 * - Type-aware field rendering via DiffFieldRenderer
 */
@Component({
	selector: 'mcms-version-diff-dialog',
	imports: [
		DatePipe,
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		Button,
		Skeleton,
		DiffFieldRendererComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-dialog class="max-w-4xl">
			<mcms-dialog-header>
				<mcms-dialog-title>Compare Versions</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<!-- Version Selector Bar -->
				<div class="mb-4 flex flex-wrap items-center gap-2" data-testid="version-selector-bar">
					<select
						class="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
						(change)="onVersion1Change($event)"
						data-testid="version-select-left"
						aria-label="Select older version"
					>
						<option value="current" [selected]="selectedVersion1() === 'current'">
							Current (live)
						</option>
						@for (v of data.versions; track v.id) {
							<option [value]="v.id" [selected]="selectedVersion1() === v.id">
								{{ v.createdAt | date: 'medium' }} ({{ v._status }})
							</option>
						}
					</select>

					<span class="text-sm text-muted-foreground">vs</span>

					<select
						class="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
						(change)="onVersion2Change($event)"
						data-testid="version-select-right"
						aria-label="Select newer version"
					>
						<option value="current" [selected]="selectedVersion2() === 'current'">
							Current (live)
						</option>
						@for (v of data.versions; track v.id) {
							<option [value]="v.id" [selected]="selectedVersion2() === v.id">
								{{ v.createdAt | date: 'medium' }} ({{ v._status }})
							</option>
						}
					</select>

					<div class="flex items-center gap-1">
						<button
							mcms-button
							variant="ghost"
							size="sm"
							[disabled]="!canGoPrev()"
							(click)="goPrev()"
							aria-label="Previous version pair"
							data-testid="diff-nav-prev"
						>
							&#8592; Prev
						</button>
						<button
							mcms-button
							variant="ghost"
							size="sm"
							[disabled]="!canGoNext()"
							(click)="goNext()"
							aria-label="Next version pair"
							data-testid="diff-nav-next"
						>
							Next &#8594;
						</button>
						<button
							mcms-button
							variant="ghost"
							size="sm"
							(click)="swap()"
							aria-label="Swap versions"
							data-testid="diff-swap"
						>
							&#8646; Swap
						</button>
					</div>
				</div>

				<!-- View Mode Tabs -->
				<div
					class="mb-3 flex items-center gap-2"
					data-testid="view-mode-tabs"
					role="tablist"
					aria-label="Diff view mode"
				>
					<button
						mcms-button
						[variant]="viewMode() === 'inline' ? 'primary' : 'outline'"
						size="sm"
						role="tab"
						id="tab-inline"
						aria-controls="diff-tabpanel"
						[attr.aria-selected]="viewMode() === 'inline'"
						[attr.tabindex]="viewMode() === 'inline' ? 0 : -1"
						(click)="viewMode.set('inline')"
						(keydown)="onTabKeydown($event)"
						data-testid="tab-inline"
					>
						Inline
					</button>
					<button
						mcms-button
						[variant]="viewMode() === 'side-by-side' ? 'primary' : 'outline'"
						size="sm"
						role="tab"
						id="tab-side-by-side"
						aria-controls="diff-tabpanel"
						[attr.aria-selected]="viewMode() === 'side-by-side'"
						[attr.tabindex]="viewMode() === 'side-by-side' ? 0 : -1"
						(click)="viewMode.set('side-by-side')"
						(keydown)="onTabKeydown($event)"
						data-testid="tab-side-by-side"
					>
						Side by Side
					</button>

					<div class="ml-auto flex items-center gap-2">
						<label class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<input
								type="checkbox"
								[checked]="showOnlyChanges()"
								(change)="showOnlyChanges.set(!showOnlyChanges())"
								class="rounded border-input"
								data-testid="filter-changes-only"
							/>
							Show only changes
						</label>
					</div>
				</div>

				<!-- Summary Bar -->
				@if (!isLoading() && !error()) {
					<div
						class="mb-3 flex items-center gap-3 text-xs text-muted-foreground"
						data-testid="diff-summary"
					>
						@if (summary().added > 0) {
							<span class="flex items-center gap-1">
								<span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
								{{ summary().added }} added
							</span>
						}
						@if (summary().removed > 0) {
							<span class="flex items-center gap-1">
								<span class="inline-block h-2 w-2 rounded-full bg-red-500"></span>
								{{ summary().removed }} removed
							</span>
						}
						@if (summary().changed > 0) {
							<span class="flex items-center gap-1">
								<span class="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
								{{ summary().changed }} changed
							</span>
						}
						@if (summary().added === 0 && summary().removed === 0 && summary().changed === 0) {
							<span>No differences</span>
						}
					</div>
				}

				<!-- Diff Content -->
				<div
					role="tabpanel"
					id="diff-tabpanel"
					[attr.aria-labelledby]="viewMode() === 'inline' ? 'tab-inline' : 'tab-side-by-side'"
				>
					@if (isLoading()) {
						<div class="space-y-4">
							@for (i of [1, 2, 3]; track i) {
								<mcms-skeleton class="h-20 w-full" />
							}
						</div>
					} @else if (error()) {
						<p class="text-sm text-destructive" role="alert">{{ error() }}</p>
					} @else if (visibleDiffs().length === 0) {
						<p class="text-sm text-muted-foreground">
							{{
								showOnlyChanges()
									? 'No differences found between these versions.'
									: 'No fields to display.'
							}}
						</p>
					} @else {
						<div class="space-y-3 max-h-[60vh] overflow-y-auto" data-testid="diff-content">
							@for (diff of visibleDiffs(); track diff.field) {
								<mcms-diff-field-renderer [diff]="diff" [mode]="viewMode()" />
							}
						</div>
					}
				</div>
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

	readonly selectedVersion1 = signal(this.data.versionId1);
	readonly selectedVersion2 = signal(this.data.versionId2);
	readonly viewMode = signal<'inline' | 'side-by-side'>('inline');
	readonly showOnlyChanges = signal(true);
	readonly isLoading = signal(true);
	readonly error = signal<string | null>(null);
	readonly differences = signal<DeepDiffResult[]>([]);

	/** Monotonic counter to discard stale responses from superseded requests. */
	private requestId = 0;

	/** Diffs filtered by showOnlyChanges toggle */
	readonly visibleDiffs = computed(() => {
		const diffs = this.differences();
		if (this.showOnlyChanges()) {
			return diffs.filter((d) => d.changeType !== 'unchanged');
		}
		return diffs;
	});

	/** Summary counts of change types */
	readonly summary = computed(() => {
		const diffs = this.differences();
		let added = 0;
		let removed = 0;
		let changed = 0;
		for (const d of diffs) {
			if (d.changeType === 'added') added++;
			else if (d.changeType === 'removed') removed++;
			else if (d.changeType === 'changed') changed++;
		}
		return { added, removed, changed };
	});

	/**
	 * Index in the selectable entries list.
	 * "current" is index -1 (virtual entry before all versions).
	 */
	private versionIndex(id: string): number {
		if (id === 'current') return -1;
		return this.data.versions.findIndex((v) => v.id === id);
	}

	private idAtIndex(index: number): string {
		if (index === -1) return 'current';
		return this.data.versions[index]?.id ?? 'current';
	}

	readonly canGoPrev = computed(() => {
		const idx1 = this.versionIndex(this.selectedVersion1());
		const idx2 = this.versionIndex(this.selectedVersion2());
		return idx1 >= 0 && idx2 >= 0;
	});

	readonly canGoNext = computed(() => {
		const idx1 = this.versionIndex(this.selectedVersion1());
		const idx2 = this.versionIndex(this.selectedVersion2());
		const max = this.data.versions.length - 1;
		return idx1 < max && idx2 < max;
	});

	constructor() {
		// Re-load differences when version selections change
		effect(() => {
			const v1 = this.selectedVersion1();
			const v2 = this.selectedVersion2();
			if (v1 && v2) {
				this.loadDifferences(v1, v2);
			}
		});
	}

	onVersion1Change(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLSelectElement) {
			this.selectedVersion1.set(target.value);
		}
	}

	onVersion2Change(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLSelectElement) {
			this.selectedVersion2.set(target.value);
		}
	}

	goPrev(): void {
		const idx1 = this.versionIndex(this.selectedVersion1());
		const idx2 = this.versionIndex(this.selectedVersion2());
		if (idx1 >= 0 && idx2 >= 0) {
			this.selectedVersion1.set(this.idAtIndex(idx1 - 1));
			this.selectedVersion2.set(this.idAtIndex(idx2 - 1));
		}
	}

	goNext(): void {
		const idx1 = this.versionIndex(this.selectedVersion1());
		const idx2 = this.versionIndex(this.selectedVersion2());
		const max = this.data.versions.length - 1;
		if (idx1 < max && idx2 < max) {
			this.selectedVersion1.set(this.idAtIndex(idx1 + 1));
			this.selectedVersion2.set(this.idAtIndex(idx2 + 1));
		}
	}

	swap(): void {
		const v1 = this.selectedVersion1();
		const v2 = this.selectedVersion2();
		this.selectedVersion1.set(v2);
		this.selectedVersion2.set(v1);
	}

	/** Handle arrow-key navigation between tabs (WAI-ARIA Tabs pattern). */
	onTabKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault();
			const next = this.viewMode() === 'inline' ? 'side-by-side' : 'inline';
			this.viewMode.set(next);
			const targetId = next === 'inline' ? 'tab-inline' : 'tab-side-by-side';
			const target = event.target;
			if (target instanceof HTMLElement) {
				target.ownerDocument.getElementById(targetId)?.focus();
			}
		}
	}

	private async loadDifferences(versionId1: string, versionId2: string): Promise<void> {
		const currentRequest = ++this.requestId;
		this.isLoading.set(true);
		this.error.set(null);

		try {
			const diffs = await this.versionService.compareVersions(
				this.data.collection,
				this.data.documentId,
				versionId1,
				versionId2,
			);
			if (currentRequest !== this.requestId) return;
			this.differences.set(diffs);
		} catch {
			if (currentRequest !== this.requestId) return;
			this.error.set('Failed to compare versions');
		} finally {
			if (currentRequest === this.requestId) {
				this.isLoading.set(false);
			}
		}
	}
}

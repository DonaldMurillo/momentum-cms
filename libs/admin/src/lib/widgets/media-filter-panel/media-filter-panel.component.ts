import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroFunnel,
	heroChevronDown,
	heroChevronUp,
	heroPhoto,
	heroDocument,
	heroVideoCamera,
	heroMusicalNote,
	heroQuestionMarkCircle,
} from '@ng-icons/heroicons/outline';
import { DateRangePicker, type DateRangeValue } from '@momentumcms/ui';

export type MimeCategory = 'image' | 'document' | 'video' | 'audio' | 'other' | null;

export interface SizePreset {
	label: string;
	gte?: number;
	lte?: number;
}

export const SIZE_PRESETS: SizePreset[] = [
	{ label: '< 1 MB', lte: 1024 * 1024 },
	{ label: '1-10 MB', gte: 1024 * 1024, lte: 10 * 1024 * 1024 },
	{ label: '10-100 MB', gte: 10 * 1024 * 1024, lte: 100 * 1024 * 1024 },
	{ label: '> 100 MB', gte: 100 * 1024 * 1024 },
];

export interface MediaFilterState {
	mimeCategory: MimeCategory;
	dateRange: DateRangeValue | null;
	sizePreset: SizePreset | null;
}

/**
 * Build a where clause from the current filter state.
 */
export function buildFilterWhere(state: MediaFilterState): Record<string, unknown> {
	const where: Record<string, unknown> = {};

	if (state.mimeCategory) {
		const mimeMap: Record<string, string> = {
			image: 'image/%',
			video: 'video/%',
			audio: 'audio/%',
			document: 'application/%',
		};
		if (state.mimeCategory === 'other') {
			where['mimeType'] = {
				not_like: 'image/%',
				and: {
					not_like: 'video/%',
					and: { not_like: 'audio/%', and: { not_like: 'application/%' } },
				},
			};
		} else {
			where['mimeType'] = { like: mimeMap[state.mimeCategory] };
		}
	}

	if (state.dateRange?.start && state.dateRange?.end) {
		where['createdAt'] = {
			gte: state.dateRange.start.toISOString(),
			lte: state.dateRange.end.toISOString(),
		};
	}

	if (state.sizePreset) {
		const sizeWhere: Record<string, unknown> = {};
		if (state.sizePreset.gte !== undefined) sizeWhere['gte'] = state.sizePreset.gte;
		if (state.sizePreset.lte !== undefined) sizeWhere['lte'] = state.sizePreset.lte;
		where['filesize'] = sizeWhere;
	}

	return where;
}

@Component({
	selector: 'mcms-media-filter-panel',
	imports: [NgIcon, DateRangePicker],
	providers: [
		provideIcons({
			heroFunnel,
			heroChevronDown,
			heroChevronUp,
			heroPhoto,
			heroDocument,
			heroVideoCamera,
			heroMusicalNote,
			heroQuestionMarkCircle,
		}),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<!-- Toggle button -->
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--mcms-border))] bg-[hsl(var(--mcms-card))] px-3 py-2 text-sm transition-colors hover:bg-[hsl(var(--mcms-accent))]"
			(click)="isExpanded.set(!isExpanded())"
			[attr.aria-expanded]="isExpanded()"
			data-slot="toggle"
		>
			<ng-icon name="heroFunnel" class="h-4 w-4" aria-hidden="true" />
			Filters
			@if (activeFilterCount() > 0) {
				<span
					class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--mcms-primary))] px-1 text-xs text-[hsl(var(--mcms-primary-foreground))]"
				>
					{{ activeFilterCount() }}
				</span>
			}
			<ng-icon
				[name]="isExpanded() ? 'heroChevronUp' : 'heroChevronDown'"
				class="h-4 w-4"
				aria-hidden="true"
			/>
		</button>

		@if (isExpanded()) {
			<div
				class="mt-3 space-y-4 rounded-lg border border-[hsl(var(--mcms-border))] bg-[hsl(var(--mcms-card))] p-4"
				data-slot="panel"
			>
				<!-- MIME Category -->
				<div>
					<p
						class="mb-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--mcms-muted-foreground))]"
					>
						File Type
					</p>
					<div class="flex flex-wrap gap-2" role="group" aria-label="Filter by file type">
						@for (cat of mimeCategories; track cat.value) {
							<button
								type="button"
								class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
								[class.bg-[hsl(var(--mcms-primary))]]="selectedMime() === cat.value"
								[class.text-[hsl(var(--mcms-primary-foreground))]]="selectedMime() === cat.value"
								[class.border-[hsl(var(--mcms-primary))]]="selectedMime() === cat.value"
								[class.border-[hsl(var(--mcms-border))]]="selectedMime() !== cat.value"
								[class.hover:bg-[hsl(var(--mcms-accent))]]="selectedMime() !== cat.value"
								(click)="toggleMime(cat.value)"
								[attr.aria-pressed]="selectedMime() === cat.value"
								[attr.data-mime]="cat.value"
							>
								<ng-icon [name]="cat.icon" class="h-3.5 w-3.5" aria-hidden="true" />
								{{ cat.label }}
							</button>
						}
					</div>
				</div>

				<!-- Date Range -->
				<div>
					<p
						class="mb-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--mcms-muted-foreground))]"
					>
						Upload Date
					</p>
					<mcms-date-range-picker
						placeholder="Any date"
						[value]="selectedDateRange()"
						(rangeSelected)="onDateRangeSelected($event)"
					/>
					@if (selectedDateRange()) {
						<button
							type="button"
							class="ml-2 text-xs text-[hsl(var(--mcms-muted-foreground))] underline hover:text-[hsl(var(--mcms-foreground))]"
							(click)="clearDateRange()"
							data-slot="clear-date"
						>
							Clear
						</button>
					}
				</div>

				<!-- Size Presets -->
				<div>
					<p
						class="mb-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--mcms-muted-foreground))]"
					>
						File Size
					</p>
					<div class="flex flex-wrap gap-2" role="group" aria-label="Filter by file size">
						@for (preset of sizePresets; track preset.label) {
							<button
								type="button"
								class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
								[class.bg-[hsl(var(--mcms-primary))]]="selectedSize()?.label === preset.label"
								[class.text-[hsl(var(--mcms-primary-foreground))]]="
									selectedSize()?.label === preset.label
								"
								[class.border-[hsl(var(--mcms-primary))]]="selectedSize()?.label === preset.label"
								[class.border-[hsl(var(--mcms-border))]]="selectedSize()?.label !== preset.label"
								[class.hover:bg-[hsl(var(--mcms-accent))]]="selectedSize()?.label !== preset.label"
								(click)="toggleSize(preset)"
								[attr.aria-pressed]="selectedSize()?.label === preset.label"
								[attr.data-size]="preset.label"
							>
								{{ preset.label }}
							</button>
						}
					</div>
				</div>
			</div>
		}
	`,
})
export class MediaFilterPanelComponent {
	readonly mimeCategories: { value: MimeCategory; label: string; icon: string }[] = [
		{ value: 'image', label: 'Images', icon: 'heroPhoto' },
		{ value: 'document', label: 'Documents', icon: 'heroDocument' },
		{ value: 'video', label: 'Video', icon: 'heroVideoCamera' },
		{ value: 'audio', label: 'Audio', icon: 'heroMusicalNote' },
		{ value: 'other', label: 'Other', icon: 'heroQuestionMarkCircle' },
	];

	readonly sizePresets = SIZE_PRESETS;

	readonly selectedMime = signal<MimeCategory>(null);
	readonly selectedDateRange = signal<DateRangeValue | null>(null);
	readonly selectedSize = signal<SizePreset | null>(null);
	readonly isExpanded = signal(false);

	readonly filterChanged = output<MediaFilterState>();

	readonly activeFilterCount = computed(() => {
		let count = 0;
		if (this.selectedMime()) count++;
		if (this.selectedDateRange()) count++;
		if (this.selectedSize()) count++;
		return count;
	});

	readonly filterState = computed<MediaFilterState>(() => ({
		mimeCategory: this.selectedMime(),
		dateRange: this.selectedDateRange(),
		sizePreset: this.selectedSize(),
	}));

	toggleMime(category: MimeCategory): void {
		this.selectedMime.set(this.selectedMime() === category ? null : category);
		this.emitState();
	}

	onDateRangeSelected(range: DateRangeValue): void {
		this.selectedDateRange.set(range);
		this.emitState();
	}

	clearDateRange(): void {
		this.selectedDateRange.set(null);
		this.emitState();
	}

	toggleSize(preset: SizePreset): void {
		this.selectedSize.set(this.selectedSize()?.label === preset.label ? null : preset);
		this.emitState();
	}

	private emitState(): void {
		this.filterChanged.emit(this.filterState());
	}
}

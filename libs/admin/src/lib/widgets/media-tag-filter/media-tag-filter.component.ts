import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus, heroXMark } from '@ng-icons/heroicons/outline';

export interface MediaTag {
	id: string;
	name: string;
	color?: string;
}

@Component({
	selector: 'mcms-media-tag-filter',
	imports: [NgIcon],
	providers: [provideIcons({ heroPlus, heroXMark })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tags">
			@for (tag of tags(); track tag.id) {
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors border"
					[style.background-color]="
						isSelected(tag.id) ? tag.color || 'hsl(var(--mcms-primary))' : 'transparent'
					"
					[style.border-color]="tag.color || 'hsl(var(--mcms-border))'"
					[style.color]="
						isSelected(tag.id) ? getContrastColor(tag.color) : 'hsl(var(--mcms-foreground))'
					"
					(click)="toggleTag(tag.id)"
					[attr.aria-pressed]="isSelected(tag.id)"
					[attr.data-tag-id]="tag.id"
				>
					@if (tag.color) {
						<span
							class="h-2 w-2 rounded-full"
							[style.background-color]="
								isSelected(tag.id) ? getContrastColor(tag.color) : tag.color
							"
							aria-hidden="true"
						></span>
					}
					{{ tag.name }}
					@if (isSelected(tag.id)) {
						<ng-icon name="heroXMark" class="h-3 w-3" aria-hidden="true" />
					}
				</button>
			}

			@if (showCreateButton()) {
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-dashed border-[hsl(var(--mcms-border))] px-3 py-1 text-xs text-[hsl(var(--mcms-muted-foreground))] transition-colors hover:bg-[hsl(var(--mcms-accent))] hover:text-[hsl(var(--mcms-foreground))]"
					(click)="createTagClicked.emit()"
					data-slot="create-tag"
				>
					<ng-icon name="heroPlus" class="h-3 w-3" aria-hidden="true" />
					Add Tag
				</button>
			}
		</div>
	`,
})
export class MediaTagFilterComponent {
	readonly tags = input<MediaTag[]>([]);
	readonly selectedTagIds = input<Set<string>>(new Set());
	readonly showCreateButton = input(true);

	readonly tagSelectionChanged = output<Set<string>>();
	readonly createTagClicked = output<void>();

	isSelected(tagId: string): boolean {
		return this.selectedTagIds().has(tagId);
	}

	toggleTag(tagId: string): void {
		const selected = new Set(this.selectedTagIds());
		if (selected.has(tagId)) {
			selected.delete(tagId);
		} else {
			selected.add(tagId);
		}
		this.tagSelectionChanged.emit(selected);
	}

	/**
	 * Returns white or black based on the background color brightness.
	 */
	getContrastColor(color?: string): string {
		if (!color || !color.startsWith('#')) return '#ffffff';
		const hex = color.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		// YIQ formula
		const yiq = (r * 299 + g * 587 + b * 114) / 1000;
		return yiq >= 128 ? '#000000' : '#ffffff';
	}
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Shape of a single generated image variant. */
export interface ImageVariantData {
	url: string;
	path: string;
	width: number;
	height: number;
	mimeType: string;
	filesize: number;
}

/**
 * Displays generated image size variants as a grid of thumbnail cards.
 *
 * @example
 * ```html
 * <mcms-image-variants-display [sizes]="entity.sizes" />
 * ```
 */
@Component({
	selector: 'mcms-image-variants-display',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (variants().length > 0) {
			<div class="space-y-3">
				<p class="text-sm font-medium">Generated Sizes</p>
				<div class="grid gap-3 grid-cols-2 sm:grid-cols-3">
					@for (variant of variants(); track variant.name) {
						<div class="rounded-lg border border-mcms-border bg-mcms-card overflow-hidden">
							<img
								[src]="variantUrl(variant)"
								[alt]="variant.name + ' variant'"
								class="h-24 w-full object-cover bg-mcms-muted"
							/>
							<div class="p-2">
								<p class="text-xs font-medium">{{ variant.name }}</p>
								<p class="text-xs text-mcms-muted-foreground">
									{{ variant.width }} &times; {{ variant.height }}
								</p>
								<p class="text-xs text-mcms-muted-foreground">
									{{ formatFileSize(variant.filesize) }}
								</p>
							</div>
						</div>
					}
				</div>
			</div>
		}
	`,
})
export class ImageVariantsDisplay {
	/** The sizes record from the media document (e.g., entity['sizes']) */
	readonly sizes = input<Record<string, unknown> | null | undefined>(null);

	/** Parsed variant entries */
	readonly variants = computed(() => {
		const sizes = this.sizes();
		if (!sizes || typeof sizes !== 'object') return [];
		return Object.entries(sizes)
			.filter((entry): entry is [string, ImageVariantData] => {
				const v = entry[1];
				return v != null && typeof v === 'object' && 'width' in v && 'path' in v;
			})
			.map(([name, data]) => ({
				name,
				...data,
			}));
	});

	/** Build URL for a variant image */
	variantUrl(variant: ImageVariantData): string {
		if (variant.url) return variant.url;
		if (variant.path) return `/api/media/file/${variant.path}`;
		return '';
	}

	/** Format file size for display */
	formatFileSize(bytes: number): string {
		if (!bytes) return '';
		if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${bytes} bytes`;
	}
}

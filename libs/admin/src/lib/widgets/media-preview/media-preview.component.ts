import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
	heroPhoto,
	heroDocument,
	heroFilm,
	heroMusicalNote,
	heroArchiveBox,
	heroDocumentText,
} from '@ng-icons/heroicons/outline';

/**
 * Media document data for preview.
 */
export interface MediaPreviewData {
	url?: string;
	path?: string;
	mimeType?: string;
	filename?: string;
	alt?: string;
}

/**
 * Media Preview Component
 *
 * Displays a preview of media based on its type:
 * - Images: Thumbnail preview
 * - Videos: Video icon with optional poster
 * - Audio: Audio icon
 * - Documents: Document icon
 * - Other: Generic file icon
 *
 * @example
 * ```html
 * <mcms-media-preview
 *   [media]="mediaDocument"
 *   [size]="'md'"
 * />
 * ```
 */
@Component({
	selector: 'mcms-media-preview',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		@if (isImage()) {
			<img
				[src]="imageUrl()"
				[alt]="media()?.alt ?? media()?.filename ?? 'Media preview'"
				class="h-full w-full object-cover"
			/>
		} @else {
			<div class="flex h-full w-full items-center justify-center bg-mcms-muted">
				<ng-icon [name]="iconName()" [class]="iconClasses()" />
			</div>
		}
	`,
	imports: [NgIcon],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaPreviewComponent {
	/** Media data to preview */
	readonly media = input<MediaPreviewData | null>(null);

	/** Size of the preview */
	readonly size = input<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');

	/** Custom class override */
	readonly class = input('');

	/** Whether to show rounded corners */
	readonly rounded = input(true);

	/** Host classes */
	readonly hostClasses = computed(() => {
		const sizeClass = this.sizeClasses()[this.size()];
		const roundedClass = this.rounded() ? 'rounded-md overflow-hidden' : '';
		return `inline-block ${sizeClass} ${roundedClass} ${this.class()}`;
	});

	/** Size classes map */
	private readonly sizeClasses = computed(() => ({
		xs: 'h-8 w-8',
		sm: 'h-12 w-12',
		md: 'h-20 w-20',
		lg: 'h-32 w-32',
		xl: 'h-48 w-48',
	}));

	/** Icon size classes */
	readonly iconClasses = computed(() => {
		const sizes: Record<string, string> = {
			xs: 'text-lg',
			sm: 'text-xl',
			md: 'text-3xl',
			lg: 'text-4xl',
			xl: 'text-6xl',
		};
		return `${sizes[this.size()]} text-mcms-muted-foreground`;
	});

	/** Whether the media is an image */
	readonly isImage = computed(() => {
		const mimeType = this.media()?.mimeType ?? '';
		return mimeType.startsWith('image/');
	});

	/** Whether the media is a video */
	readonly isVideo = computed(() => {
		const mimeType = this.media()?.mimeType ?? '';
		return mimeType.startsWith('video/');
	});

	/** Whether the media is audio */
	readonly isAudio = computed(() => {
		const mimeType = this.media()?.mimeType ?? '';
		return mimeType.startsWith('audio/');
	});

	/** Image URL for preview */
	readonly imageUrl = computed(() => {
		const media = this.media();
		if (!media) return '';
		return media.url ?? `/api/media/file/${media.path}`;
	});

	/** Icon name based on media type */
	readonly iconName = computed(() => {
		const mimeType = this.media()?.mimeType ?? '';

		if (mimeType.startsWith('video/')) {
			return heroFilm;
		}
		if (mimeType.startsWith('audio/')) {
			return heroMusicalNote;
		}
		if (mimeType === 'application/pdf') {
			return heroDocumentText;
		}
		if (mimeType.startsWith('application/zip') || mimeType.includes('compressed')) {
			return heroArchiveBox;
		}
		if (mimeType.startsWith('image/')) {
			return heroPhoto;
		}

		return heroDocument;
	});
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LivePreviewService } from '@momentumcms/admin';

@Component({
	selector: 'app-post-preview',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<article class="font-sans leading-relaxed text-gray-800 p-8 max-w-2xl mx-auto">
			<h1 class="text-3xl font-bold mb-2" data-testid="preview-title">{{ title() }}</h1>
			@if (slug()) {
				<div class="text-sm text-gray-500 mb-6">/posts/{{ slug() }}</div>
			}
		</article>
	`,
})
export class PostPreviewComponent {
	private readonly preview = inject(LivePreviewService);

	readonly title = computed(() => String(this.preview.documentData()['title'] ?? 'Untitled'));
	readonly slug = computed(() => String(this.preview.documentData()['slug'] ?? ''));
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LivePreviewService } from '@momentumcms/admin/live-preview';

/**
 * Live preview component for the Events collection.
 * Renders event data from the form in real-time.
 */
@Component({
	selector: 'app-event-preview',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="font-sans leading-relaxed text-gray-800 p-8 max-w-2xl mx-auto">
			<h1
				class="text-3xl font-bold mb-6 pb-3 border-b-2 border-gray-200"
				data-testid="preview-title"
			>
				{{ title() }}
			</h1>
			@if (location()) {
				<div class="mb-4">
					<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
						Location
					</div>
					<div class="text-base text-gray-700" data-testid="preview-location">{{ location() }}</div>
				</div>
			}
			@if (eventDate()) {
				<div class="mb-4">
					<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Date</div>
					<div class="text-base text-gray-700">{{ eventDate() }}</div>
				</div>
			}
			@if (description()) {
				<div class="mb-4">
					<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
						Description
					</div>
					<div class="text-base text-gray-700">{{ description() }}</div>
				</div>
			}
		</div>
	`,
})
export class EventPreviewComponent {
	private readonly preview = inject(LivePreviewService);

	readonly title = computed(() => String(this.preview.documentData()['title'] ?? 'Untitled'));
	readonly description = computed(() => String(this.preview.documentData()['description'] ?? ''));
	readonly location = computed(() => String(this.preview.documentData()['location'] ?? ''));
	readonly eventDate = computed(() => {
		const val = this.preview.documentData()['eventDate'];
		if (!val) return '';
		try {
			return new Date(String(val)).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});
		} catch {
			return String(val);
		}
	});
}

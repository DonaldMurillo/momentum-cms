import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
	selector: 'app-feature-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-feature"',
	},
	template: `
		<section class="py-8 px-8">
			<div class="bg-white border rounded-lg p-6 shadow-sm">
				@if (icon()) {
					<div class="text-3xl mb-3" data-testid="feature-icon">{{ icon() }}</div>
				}
				<h3 class="text-xl font-semibold mb-2" data-testid="feature-title">{{ title() }}</h3>
				@if (description()) {
					<p class="text-gray-600" data-testid="feature-description">{{ description() }}</p>
				}
			</div>
		</section>
	`,
})
export class FeatureBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly title = computed((): string => String(this.data()['title'] ?? ''));
	readonly description = computed((): string => String(this.data()['description'] ?? ''));
	readonly icon = computed((): string => String(this.data()['icon'] ?? ''));
}

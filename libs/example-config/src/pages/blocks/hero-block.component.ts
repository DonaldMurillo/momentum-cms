import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
	selector: 'app-hero-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-hero"',
	},
	template: `
		<section
			class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-20 px-8 text-center rounded-lg"
		>
			<h1 class="text-4xl font-bold mb-4" data-testid="hero-heading">{{ heading() }}</h1>
			@if (subheading()) {
				<p class="text-xl opacity-90 mb-8" data-testid="hero-subheading">{{ subheading() }}</p>
			}
			@if (ctaText()) {
				<a
					class="inline-block bg-white text-indigo-600 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors"
					[href]="ctaLink() || '#'"
					data-testid="hero-cta"
				>
					{{ ctaText() }}
				</a>
			}
		</section>
	`,
})
export class HeroBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly subheading = computed((): string => String(this.data()['subheading'] ?? ''));
	readonly ctaText = computed((): string => String(this.data()['ctaText'] ?? ''));
	readonly ctaLink = computed((): string => String(this.data()['ctaLink'] ?? ''));
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
	selector: 'app-hero-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-hero"',
	},
	template: `
		<section class="bg-primary text-primary-foreground py-12 px-4 md:py-20 md:px-8 text-center">
			<div class="mx-auto max-w-4xl">
				<h1 class="text-3xl md:text-4xl lg:text-5xl font-bold mb-4" data-testid="hero-heading">
					{{ heading() }}
				</h1>
				@if (subheading()) {
					<p class="text-lg md:text-xl text-primary-foreground mb-8" data-testid="hero-subheading">
						{{ subheading() }}
					</p>
				}
				@if (ctaText()) {
					<a
						class="inline-block bg-primary-foreground text-primary font-semibold px-6 py-3 rounded-lg hover:bg-primary-foreground/90 transition-colors"
						[href]="ctaLink() || '#'"
						data-testid="hero-cta"
					>
						{{ ctaText() }}
					</a>
				}
			</div>
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

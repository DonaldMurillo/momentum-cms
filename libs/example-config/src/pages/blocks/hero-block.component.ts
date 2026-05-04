import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Hero block — editorial left-aligned, no saturated brand wall. The previous
 * design painted a giant `bg-primary` rectangle with a white centered heading,
 * which is the canonical "AI hero" template. This version reads like the front
 * matter of an essay: small eyebrow tag, large display title, a paragraph, and
 * one quiet inline CTA. Clients who want a "splashy" hero can override this
 * component in their own `provideBlockComponents()`.
 */
@Component({
	selector: 'app-hero-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-hero"',
	},
	template: `
		<section class="px-4 md:px-8 pt-16 pb-12 md:pt-24 md:pb-20">
			<div class="mx-auto max-w-5xl flex flex-col gap-5">
				@if (eyebrow()) {
					<span
						class="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
					>
						{{ eyebrow() }}
					</span>
				}
				<h1
					class="text-4xl md:text-6xl font-semibold -tracking-[0.025em] leading-[1.05] text-foreground max-w-3xl"
					data-testid="hero-heading"
				>
					{{ heading() }}
				</h1>
				@if (subheading()) {
					<p
						class="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-[58ch]"
						data-testid="hero-subheading"
					>
						{{ subheading() }}
					</p>
				}
				@if (ctaText()) {
					<div class="mt-2">
						<a
							class="group inline-flex items-baseline gap-1.5 text-base font-medium text-primary hover:text-foreground transition-colors"
							[href]="ctaLink() || '#'"
							data-testid="hero-cta"
						>
							{{ ctaText() }}
							<span
								class="text-sm transition-transform group-hover:translate-x-0.5"
								aria-hidden="true"
								>→</span
							>
						</a>
					</div>
				}
			</div>
		</section>
	`,
})
export class HeroBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	/** Optional eyebrow tag — defaults to the legacy `eyebrow` field if present. */
	readonly eyebrow = computed((): string => String(this.data()['eyebrow'] ?? ''));
	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly subheading = computed((): string => String(this.data()['subheading'] ?? ''));
	readonly ctaText = computed((): string => String(this.data()['ctaText'] ?? ''));
	readonly ctaLink = computed((): string => String(this.data()['ctaLink'] ?? ''));
}

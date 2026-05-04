import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Testimonial block — replaces the centered "italic quote in a bordered card"
 * (every shadcn template) with a side-by-side editorial layout: large pull
 * quote on the left, attribution stack (name + role + company) on the right
 * separated by a hairline. The opening quote glyph is oversized and treated
 * as a graphic element, not just punctuation.
 */
@Component({
	selector: 'app-testimonial-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-testimonial"',
	},
	template: `
		<section class="px-4 md:px-8 py-16 md:py-24">
			<div class="mx-auto max-w-5xl">
				<blockquote class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_14rem] gap-x-12 gap-y-8">
					<div class="relative">
						<span
							aria-hidden="true"
							class="absolute -top-6 -left-1 text-7xl md:text-8xl text-primary/15 font-serif leading-none select-none"
							>“</span
						>
						<p
							class="relative text-2xl md:text-[1.875rem] font-medium -tracking-[0.012em] leading-[1.35] text-foreground max-w-[36ch]"
							data-testid="testimonial-quote"
						>
							{{ quote() }}
						</p>
					</div>
					<footer class="md:border-l md:border-border md:pl-8 flex flex-col gap-1">
						<span
							class="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
						>
							In their words
						</span>
						<div
							class="text-base font-semibold text-foreground -tracking-[0.01em] mt-2"
							data-testid="testimonial-author"
						>
							{{ authorName() }}
						</div>
						@if (authorRole()) {
							<div class="text-sm text-muted-foreground" data-testid="testimonial-role">
								{{ authorRole() }}
							</div>
						}
						@if (authorCompany()) {
							<div class="text-sm text-muted-foreground/80">{{ authorCompany() }}</div>
						}
					</footer>
				</blockquote>
			</div>
		</section>
	`,
})
export class TestimonialBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly quote = computed((): string => String(this.data()['quote'] ?? ''));
	readonly authorName = computed((): string => String(this.data()['authorName'] ?? ''));
	readonly authorRole = computed((): string => String(this.data()['authorRole'] ?? ''));
	readonly authorCompany = computed((): string => String(this.data()['authorCompany'] ?? ''));
}

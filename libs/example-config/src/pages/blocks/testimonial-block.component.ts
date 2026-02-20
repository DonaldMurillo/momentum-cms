import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
	selector: 'app-testimonial-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-testimonial"',
	},
	template: `
		<section class="py-8 px-4 md:py-16 md:px-8">
			<div class="mx-auto max-w-3xl">
				<blockquote class="bg-card border border-border rounded-lg p-8 md:p-12 text-center">
					<p
						class="text-xl md:text-2xl text-foreground italic leading-relaxed mb-6"
						data-testid="testimonial-quote"
					>
						&ldquo;{{ quote() }}&rdquo;
					</p>
					<footer>
						<div class="font-semibold text-foreground" data-testid="testimonial-author">
							{{ authorName() }}
						</div>
						@if (authorRole() || authorCompany()) {
							<div class="text-sm text-muted-foreground mt-1" data-testid="testimonial-role">
								@if (authorRole()) {
									{{ authorRole() }}
								}
								@if (authorRole() && authorCompany()) {
									,&nbsp;
								}
								@if (authorCompany()) {
									{{ authorCompany() }}
								}
							</div>
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

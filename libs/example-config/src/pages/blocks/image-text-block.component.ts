import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Image + text block — side-by-side editorial layout. Drops the rounded-lg
 * frame around the image (felt like a bordered Shopify card) for a clean edge.
 * The text column uses an eyebrow + heading + paragraph stack so it reads as
 * the lede of a magazine feature.
 */
@Component({
	selector: 'app-image-text-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-imageText"',
	},
	template: `
		<section class="px-4 md:px-8 py-12 md:py-20">
			<div
				class="mx-auto max-w-6xl flex flex-col gap-8 md:gap-16 items-center"
				[class.md:flex-row]="!reversed()"
				[class.md:flex-row-reverse]="reversed()"
			>
				<div class="w-full md:w-1/2" data-testid="image-text-image">
					@if (imageUrl()) {
						<img
							[src]="imageUrl()"
							[alt]="imageAlt() || heading()"
							class="w-full h-auto object-cover"
							loading="lazy"
						/>
					} @else {
						<div
							class="w-full aspect-[4/3] bg-muted flex items-center justify-center border border-border"
						>
							<span
								class="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
							>
								No image
							</span>
						</div>
					}
				</div>

				<div class="w-full md:w-1/2 flex flex-col gap-4">
					@if (eyebrow()) {
						<span
							class="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
						>
							{{ eyebrow() }}
						</span>
					}
					<h2
						class="text-2xl md:text-3xl font-semibold -tracking-[0.018em] text-foreground"
						data-testid="image-text-heading"
					>
						{{ heading() }}
					</h2>
					<p
						class="text-base md:text-lg text-muted-foreground leading-[1.65] max-w-[55ch]"
						data-testid="image-text-body"
					>
						{{ body() }}
					</p>
				</div>
			</div>
		</section>
	`,
})
export class ImageTextBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly eyebrow = computed((): string => String(this.data()['eyebrow'] ?? ''));
	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly body = computed((): string => String(this.data()['body'] ?? ''));
	readonly imageUrl = computed((): string => String(this.data()['imageUrl'] ?? ''));
	readonly imageAlt = computed((): string => String(this.data()['imageAlt'] ?? ''));
	readonly reversed = computed((): boolean => this.data()['imagePosition'] === 'right');
}

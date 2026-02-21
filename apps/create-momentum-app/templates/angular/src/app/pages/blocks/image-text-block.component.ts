import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
	selector: 'app-image-text-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-imageText"',
	},
	template: `
		<section class="py-8 px-4 md:py-16 md:px-8">
			<div
				class="mx-auto max-w-6xl flex flex-col gap-8 md:gap-12 items-center"
				[class.md:flex-row]="!reversed()"
				[class.md:flex-row-reverse]="reversed()"
			>
				<!-- Image -->
				<div class="w-full md:w-1/2" data-testid="image-text-image">
					@if (imageUrl()) {
						<img
							[src]="imageUrl()"
							[alt]="imageAlt() || heading()"
							class="w-full h-auto rounded-lg object-cover bg-muted"
						/>
					} @else {
						<div class="w-full aspect-video rounded-lg bg-muted flex items-center justify-center">
							<span class="text-muted-foreground text-sm">No image</span>
						</div>
					}
				</div>

				<!-- Text -->
				<div class="w-full md:w-1/2">
					<h2
						class="text-2xl md:text-3xl font-bold text-foreground mb-4"
						data-testid="image-text-heading"
					>
						{{ heading() }}
					</h2>
					<p class="text-lg text-muted-foreground leading-relaxed" data-testid="image-text-body">
						{{ body() }}
					</p>
				</div>
			</div>
		</section>
	`,
})
export class ImageTextBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly body = computed((): string => String(this.data()['body'] ?? ''));
	readonly imageUrl = computed((): string => String(this.data()['imageUrl'] ?? ''));
	readonly imageAlt = computed((): string => String(this.data()['imageAlt'] ?? ''));
	readonly reversed = computed((): boolean => this.data()['imagePosition'] === 'right');
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Text block — long-form prose section. Capped at 65ch for comfortable reading
 * (impeccable: body wider than ~80ch is fatiguing). Heading is left-aligned and
 * tightly tracked; the body uses a slightly larger leading for readability.
 */
@Component({
	selector: 'app-text-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-textBlock"',
	},
	template: `
		<section class="px-4 md:px-8 py-10 md:py-14">
			<!-- Same outer container as the other blocks (max-w-5xl) so left edges align;
			     inner column capped at 65ch for comfortable reading. -->
			<div class="mx-auto max-w-5xl">
				<div class="max-w-[65ch]">
					@if (heading()) {
						<h2
							class="text-2xl md:text-3xl font-semibold -tracking-[0.018em] text-foreground mb-5"
							data-testid="text-heading"
						>
							{{ heading() }}
						</h2>
					}
					<p class="text-base md:text-lg text-foreground/85 leading-[1.7]" data-testid="text-body">
						{{ body() }}
					</p>
				</div>
			</div>
		</section>
	`,
})
export class TextBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly body = computed((): string => String(this.data()['body'] ?? ''));
}

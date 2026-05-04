import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Call-to-action block — left-aligned editorial CTA, not a centered bg-secondary
 * "wall." The layout reads: heading, supporting paragraph, then a primary action
 * with an optional secondary text-link below. Quieter and less template-y than
 * the previous "two big buttons in a colored box" pattern.
 */
@Component({
	selector: 'app-call-to-action-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-callToAction"',
	},
	template: `
		<section class="px-4 md:px-8 py-16 md:py-24">
			<div
				class="mx-auto max-w-5xl border-t border-b border-border py-12 md:py-16 flex flex-col gap-5"
			>
				<h2
					class="text-3xl md:text-4xl font-semibold -tracking-[0.02em] text-foreground max-w-3xl"
					data-testid="cta-heading"
				>
					{{ heading() }}
				</h2>
				@if (description()) {
					<p
						class="text-lg text-muted-foreground leading-relaxed max-w-[58ch]"
						data-testid="cta-description"
					>
						{{ description() }}
					</p>
				}
				<div class="flex flex-wrap items-baseline gap-x-6 gap-y-3 mt-2">
					@if (primaryButtonText()) {
						<a
							class="inline-flex h-10 items-center rounded-[0.3125rem] bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
							[href]="primaryButtonLink() || '#'"
							data-testid="cta-primary-button"
						>
							{{ primaryButtonText() }}
						</a>
					}
					@if (secondaryButtonText()) {
						<a
							class="group inline-flex items-baseline gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
							[href]="secondaryButtonLink() || '#'"
							data-testid="cta-secondary-button"
						>
							{{ secondaryButtonText() }}
							<span
								class="text-xs transition-transform group-hover:translate-x-0.5"
								aria-hidden="true"
								>→</span
							>
						</a>
					}
				</div>
			</div>
		</section>
	`,
})
export class CallToActionBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly description = computed((): string => String(this.data()['description'] ?? ''));
	readonly primaryButtonText = computed((): string =>
		String(this.data()['primaryButtonText'] ?? ''),
	);
	readonly primaryButtonLink = computed((): string =>
		String(this.data()['primaryButtonLink'] ?? ''),
	);
	readonly secondaryButtonText = computed((): string =>
		String(this.data()['secondaryButtonText'] ?? ''),
	);
	readonly secondaryButtonLink = computed((): string =>
		String(this.data()['secondaryButtonLink'] ?? ''),
	);
}

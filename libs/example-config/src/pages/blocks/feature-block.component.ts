import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Feature block — single feature presented as a left-aligned editorial entry.
 * The previous design used the canonical "icon-on-top + bordered card" template
 * (impeccable bans this pattern). The new layout puts the icon as a small inline
 * mark next to the title, then a description paragraph below — feels written,
 * not templated.
 */
@Component({
	selector: 'app-feature-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-feature"',
	},
	template: `
		<section class="px-4 md:px-8 py-8 md:py-12">
			<div class="mx-auto max-w-5xl border-t border-border pt-8">
				<div class="max-w-[65ch]">
					<div class="flex items-baseline gap-3 mb-3">
						@if (icon()) {
							<span
								class="text-xl text-primary leading-none translate-y-0.5 select-none"
								aria-hidden="true"
								data-testid="feature-icon"
							>
								{{ icon() }}
							</span>
						}
						<h3
							class="text-lg md:text-xl font-semibold -tracking-[0.012em] text-foreground"
							data-testid="feature-title"
						>
							{{ title() }}
						</h3>
					</div>
					@if (description()) {
						<p
							class="text-base text-muted-foreground leading-[1.65]"
							data-testid="feature-description"
						>
							{{ description() }}
						</p>
					}
				</div>
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

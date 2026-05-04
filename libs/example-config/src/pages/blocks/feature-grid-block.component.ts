import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface FeatureItem {
	title: string;
	description: string;
	icon: string;
}

/**
 * Feature grid block — replaces the "three identical cards in a row" template
 * (impeccable bans uniform card grids) with a hairline-divided list. Each row
 * has a small inline icon, a heading, and a description on a defined column
 * grid. Reads as a structured spec sheet rather than a template carousel.
 */
@Component({
	selector: 'app-feature-grid-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-featureGrid"',
	},
	template: `
		<section class="px-4 md:px-8 py-12 md:py-20">
			<div class="mx-auto max-w-5xl">
				@if (eyebrow()) {
					<span
						class="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3 block"
					>
						{{ eyebrow() }}
					</span>
				}
				@if (heading()) {
					<h2
						class="text-3xl md:text-4xl font-semibold -tracking-[0.02em] text-foreground max-w-3xl"
						data-testid="feature-grid-heading"
					>
						{{ heading() }}
					</h2>
				}
				@if (description()) {
					<p
						class="text-lg text-muted-foreground leading-relaxed mt-4 max-w-[58ch]"
						data-testid="feature-grid-description"
					>
						{{ description() }}
					</p>
				}

				<dl class="mt-10 border-t border-border">
					@for (feature of features(); track $index) {
						<div
							class="grid grid-cols-1 md:grid-cols-[12rem_minmax(0,1fr)] gap-x-10 gap-y-2 border-b border-border py-6"
							data-testid="feature-grid-item"
						>
							<dt class="flex items-baseline gap-2.5">
								@if (feature.icon) {
									<span
										class="text-lg text-primary leading-none translate-y-0.5 select-none"
										aria-hidden="true"
									>
										{{ feature.icon }}
									</span>
								}
								<span class="text-base font-semibold text-foreground -tracking-[0.01em]">
									{{ feature.title }}
								</span>
							</dt>
							<dd class="text-base text-muted-foreground leading-[1.65] max-w-[60ch]">
								{{ feature.description }}
							</dd>
						</div>
					}
				</dl>
			</div>
		</section>
	`,
})
export class FeatureGridBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly eyebrow = computed((): string => String(this.data()['eyebrow'] ?? ''));
	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly description = computed((): string => String(this.data()['description'] ?? ''));
	readonly features = computed((): FeatureItem[] => {
		const raw = this.data()['features'];
		if (!Array.isArray(raw)) return [];
		return raw.map(
			(item: Record<string, unknown>): FeatureItem => ({
				title: String(item['title'] ?? ''),
				description: String(item['description'] ?? ''),
				icon: String(item['icon'] ?? ''),
			}),
		);
	});
}

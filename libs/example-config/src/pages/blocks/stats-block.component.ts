import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface StatItem {
	value: string;
	label: string;
	suffix: string;
}

/**
 * Stats block — replaces the canonical "four big-number tiles in a card grid"
 * (impeccable's "hero metric layout template" — a banned pattern) with a
 * hairline-divided horizontal row. Numbers are large but unboxed; labels are
 * the editorial eyebrow style. Reads as a publication's by-the-numbers, not a
 * marketing dashboard.
 */
@Component({
	selector: 'app-stats-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-stats"',
	},
	template: `
		<section class="px-4 md:px-8 py-12 md:py-20">
			<div class="mx-auto max-w-5xl">
				@if (heading()) {
					<h2
						class="text-2xl md:text-3xl font-semibold -tracking-[0.018em] text-foreground max-w-2xl"
						data-testid="stats-heading"
					>
						{{ heading() }}
					</h2>
				}
				@if (description()) {
					<p
						class="text-base text-muted-foreground leading-relaxed mt-3 max-w-[60ch]"
						data-testid="stats-description"
					>
						{{ description() }}
					</p>
				}

				<div
					class="mt-10 grid grid-cols-2 md:grid-cols-4 gap-y-8 md:gap-y-0 border-t border-b border-border divide-y md:divide-y-0 md:divide-x divide-border"
				>
					@for (item of items(); track $index) {
						<div class="px-0 md:px-6 py-6 md:py-8 first:pl-0 last:pr-0" data-testid="stat-item">
							<div
								class="text-4xl md:text-5xl font-semibold -tracking-[0.025em] text-foreground tabular-nums"
							>
								{{ item.value
								}}<span class="text-3xl text-muted-foreground/70">{{ item.suffix }}</span>
							</div>
							<div
								class="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
							>
								{{ item.label }}
							</div>
						</div>
					}
				</div>
			</div>
		</section>
	`,
})
export class StatsBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly description = computed((): string => String(this.data()['description'] ?? ''));
	readonly items = computed((): StatItem[] => {
		const raw = this.data()['items'];
		if (!Array.isArray(raw)) return [];
		return raw.map(
			(item: Record<string, unknown>): StatItem => ({
				value: String(item['value'] ?? ''),
				label: String(item['label'] ?? ''),
				suffix: String(item['suffix'] ?? ''),
			}),
		);
	});
}

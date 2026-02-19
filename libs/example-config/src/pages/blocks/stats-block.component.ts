import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface StatItem {
	value: string;
	label: string;
	suffix: string;
}

@Component({
	selector: 'app-stats-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-stats"',
	},
	template: `
		<section class="py-8 px-4 md:py-16 md:px-8">
			<div class="mx-auto max-w-6xl">
				@if (heading()) {
					<h2
						class="text-2xl md:text-3xl font-bold text-foreground text-center mb-4"
						data-testid="stats-heading"
					>
						{{ heading() }}
					</h2>
				}
				@if (description()) {
					<p
						class="text-lg text-muted-foreground text-center mb-10 max-w-2xl mx-auto"
						data-testid="stats-description"
					>
						{{ description() }}
					</p>
				}
				<div class="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
					@for (item of items(); track $index) {
						<div
							class="text-center bg-card border border-border rounded-lg p-6"
							data-testid="stat-item"
						>
							<div class="text-3xl md:text-4xl font-bold text-primary mb-1">
								{{ item.value }}{{ item.suffix }}
							</div>
							<div class="text-sm text-muted-foreground">{{ item.label }}</div>
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

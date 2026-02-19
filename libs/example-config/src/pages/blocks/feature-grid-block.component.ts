import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface FeatureItem {
	title: string;
	description: string;
	icon: string;
}

@Component({
	selector: 'app-feature-grid-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-featureGrid"',
	},
	template: `
		<section class="py-8 px-4 md:py-16 md:px-8">
			<div class="mx-auto max-w-6xl">
				@if (heading()) {
					<h2
						class="text-2xl md:text-3xl font-bold text-foreground text-center mb-4"
						data-testid="feature-grid-heading"
					>
						{{ heading() }}
					</h2>
				}
				@if (description()) {
					<p
						class="text-lg text-muted-foreground text-center mb-10 max-w-2xl mx-auto"
						data-testid="feature-grid-description"
					>
						{{ description() }}
					</p>
				}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					@for (feature of features(); track $index) {
						<div
							class="bg-card border border-border rounded-lg p-6"
							data-testid="feature-grid-item"
						>
							@if (feature.icon) {
								<div class="text-2xl mb-3 text-primary">{{ feature.icon }}</div>
							}
							<h3 class="text-lg font-semibold text-card-foreground mb-2">
								{{ feature.title }}
							</h3>
							@if (feature.description) {
								<p class="text-muted-foreground text-sm">{{ feature.description }}</p>
							}
						</div>
					}
				</div>
			</div>
		</section>
	`,
})
export class FeatureGridBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

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

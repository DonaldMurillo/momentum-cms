import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
	selector: 'app-call-to-action-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-callToAction"',
	},
	template: `
		<section class="bg-secondary text-secondary-foreground py-12 px-4 md:py-16 md:px-8">
			<div class="mx-auto max-w-3xl text-center">
				<h2 class="text-2xl md:text-3xl font-bold mb-4" data-testid="cta-heading">
					{{ heading() }}
				</h2>
				@if (description()) {
					<p
						class="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto"
						data-testid="cta-description"
					>
						{{ description() }}
					</p>
				}
				<div class="flex flex-col sm:flex-row gap-4 justify-center">
					@if (primaryButtonText()) {
						<a
							class="inline-block bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
							[href]="primaryButtonLink() || '#'"
							data-testid="cta-primary-button"
						>
							{{ primaryButtonText() }}
						</a>
					}
					@if (secondaryButtonText()) {
						<a
							class="inline-block border border-border text-foreground font-semibold px-6 py-3 rounded-lg hover:bg-accent transition-colors"
							[href]="secondaryButtonLink() || '#'"
							data-testid="cta-secondary-button"
						>
							{{ secondaryButtonText() }}
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

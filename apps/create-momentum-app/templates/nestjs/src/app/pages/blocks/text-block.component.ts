import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
	selector: 'app-text-block',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"block-textBlock"',
	},
	template: `
		<section class="py-8 px-4 md:py-12 md:px-8 max-w-3xl mx-auto">
			@if (heading()) {
				<h2 class="text-2xl font-bold text-foreground mb-4" data-testid="text-heading">
					{{ heading() }}
				</h2>
			}
			<p class="text-lg text-muted-foreground leading-relaxed" data-testid="text-body">
				{{ body() }}
			</p>
		</section>
	`,
})
export class TextBlockComponent {
	readonly data = input.required<Record<string, unknown>>();

	readonly heading = computed((): string => String(this.data()['heading'] ?? ''));
	readonly body = computed((): string => String(this.data()['body'] ?? ''));
}

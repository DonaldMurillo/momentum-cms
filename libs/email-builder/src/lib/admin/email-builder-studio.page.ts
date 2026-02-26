import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { EmailBuilderComponent } from '../email-builder.component';
import { EmailBuilderStateService } from '../services/email-builder-state.service';
import { provideEmailBuilder } from '../providers/provide-email-builder';
import { blocksToPreviewHtml } from '../preview/preview-renderer';
import type { EmailBlock } from '@momentumcms/email';

/**
 * Admin studio page for the email builder.
 *
 * Provides the full email builder environment with an export button
 * for generating HTML output from the current blocks.
 */
@Component({
	selector: 'eml-builder-studio',
	imports: [EmailBuilderComponent],
	providers: [provideEmailBuilder()],
	host: {
		class: 'flex h-[calc(100vh-4rem)] flex-col bg-background text-foreground',
		'data-testid': 'email-builder-studio',
	},
	template: `
		<div class="flex items-center justify-between border-b border-border px-4 py-2">
			<h1 class="text-lg font-semibold text-foreground">Email Builder</h1>
			<div class="flex items-center gap-2">
				<span class="text-sm text-muted-foreground">{{ blockCount() }} blocks</span>
				<button
					type="button"
					class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					data-testid="export-html-button"
					(click)="exportHtml()"
				>
					Export HTML
				</button>
			</div>
		</div>
		<div class="flex-1 overflow-hidden">
			<eml-builder (blocksChange)="onBlocksChange($event)" />
		</div>
		<textarea
			class="sr-only"
			data-testid="email-builder-output"
			[value]="htmlOutput()"
			readonly
			aria-label="Email HTML output"
		></textarea>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailBuilderStudioPage {
	private readonly state = inject(EmailBuilderStateService);

	readonly blockCount = computed(() => this.state.blockCount());
	readonly htmlOutput = signal('');

	onBlocksChange(_blocks: EmailBlock[]): void {
		// blocks are managed by the builder internally
	}

	exportHtml(): void {
		const html = blocksToPreviewHtml(this.state.blocks(), this.state.theme());
		this.htmlOutput.set(html);
	}
}

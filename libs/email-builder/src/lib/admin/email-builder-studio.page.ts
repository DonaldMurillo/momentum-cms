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
		<header class="flex items-end justify-between gap-6 border-b border-border px-6 pt-5 pb-4">
			<div class="flex flex-col gap-1">
				<span class="mcms-eyebrow">Tools</span>
				<h1 class="text-xl font-semibold -tracking-[0.015em]">Email builder</h1>
			</div>
			<div class="flex items-center gap-3">
				<span class="mcms-mono text-2xs text-muted-foreground tabular-nums">
					{{ blockCount() }} {{ blockCount() === 1 ? 'block' : 'blocks' }}
				</span>
				<button
					type="button"
					class="inline-flex h-[2.125rem] items-center rounded-[var(--mcms-radius)] bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
					data-testid="export-html-button"
					(click)="exportHtml()"
				>
					Export HTML
				</button>
			</div>
		</header>
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

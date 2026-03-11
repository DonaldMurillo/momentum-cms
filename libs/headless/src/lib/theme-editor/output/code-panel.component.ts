/**
 * Code Panel Component
 *
 * Displays generated CSS with copy and download functionality.
 */

import { Component, ChangeDetectionStrategy, input, signal, computed, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { ThemeConfig } from '../theme-editor.types';
import { generateThemeCSS } from '../generator/css-generator';

@Component({
	selector: 'hdl-theme-code-panel',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<div class="flex items-center justify-between mb-2">
			<div class="flex items-center gap-2">
				<label class="text-xs text-muted-foreground flex items-center gap-1.5">
					<input
						type="checkbox"
						class="accent-primary"
						[checked]="includeComponents()"
						(change)="includeComponents.set(!includeComponents())"
					/>
					Include component styles
				</label>
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="text-xs px-2 py-1 rounded border border-border text-foreground hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					aria-label="Copy CSS to clipboard"
					(click)="copyToClipboard()"
				>
					{{ copied() ? 'Copied!' : 'Copy' }}
				</button>
				<span class="sr-only" aria-live="polite">{{
					copied() ? 'CSS copied to clipboard' : ''
				}}</span>
				<button
					type="button"
					class="text-xs px-2 py-1 rounded border border-border text-foreground hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					aria-label="Download CSS file"
					(click)="downloadCSS()"
				>
					Download
				</button>
			</div>
		</div>
		<pre
			class="bg-muted/50 border border-border rounded-lg p-4 overflow-auto max-h-96 text-xs font-mono text-foreground"
			data-testid="css-output"
			role="region"
			aria-label="Generated CSS code"
			tabindex="0"
		><code>{{ generatedCSS() }}</code></pre>
	`,
})
export class CodePanelComponent {
	private readonly doc = inject(DOCUMENT);
	private readonly win = this.doc.defaultView;

	readonly config = input.required<ThemeConfig>();

	readonly includeComponents = signal(true);
	readonly copied = signal(false);

	readonly generatedCSS = computed(() =>
		generateThemeCSS(this.config(), {
			includeComponentStyles: this.includeComponents(),
		}),
	);

	async copyToClipboard(): Promise<void> {
		try {
			await this.win?.navigator.clipboard.writeText(this.generatedCSS());
		} catch {
			// Fallback
			const textarea = this.doc.createElement('textarea');
			textarea.value = this.generatedCSS();
			this.doc.body.appendChild(textarea);
			textarea.select();
			this.doc.execCommand('copy');
			this.doc.body.removeChild(textarea);
		}
		this.showCopiedFeedback();
	}

	private showCopiedFeedback(): void {
		this.copied.set(true);
		this.win?.setTimeout(() => this.copied.set(false), 2000);
	}

	downloadCSS(): void {
		if (!this.win) return;
		const blob = new Blob([this.generatedCSS()], { type: 'text/css' });
		const url = this.win.URL.createObjectURL(blob);
		const a = this.doc.createElement('a');
		a.href = url;
		a.download = 'momentum-headless-theme.css';
		this.doc.body.appendChild(a);
		a.click();
		this.doc.body.removeChild(a);
		this.win.URL.revokeObjectURL(url);
	}
}

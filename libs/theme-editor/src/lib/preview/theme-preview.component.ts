/**
 * Theme Preview Component
 *
 * Scoped preview container that injects a <style> element with the generated CSS.
 * Headless components render inside this scope so the theme CSS applies only here.
 */

import {
	Component,
	ChangeDetectionStrategy,
	input,
	computed,
	ElementRef,
	inject,
	effect,
	Renderer2,
	viewChild,
} from '@angular/core';
import { ComponentsShowcaseComponent } from './components-showcase.component';
import type { ThemeConfig } from '../theme-editor.types';
import { generateThemeCSS } from '../generator/css-generator';

@Component({
	selector: 'hdl-theme-preview',
	imports: [ComponentsShowcaseComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
		'[attr.data-testid]': '"theme-preview"',
	},
	styles: `
		[data-testid='theme-preview-scope'] {
			/* Isolate from app theme — reset inherited properties */
			all: revert;
			/* Re-apply layout properties after reset */
			display: block;
			padding: 1.5rem;
			border-radius: 0.5rem;
			border: 1px solid var(--border);
			overflow: auto;
			/* Use scoped theme variables for background/foreground */
			background: var(--background);
			color: var(--foreground);
			font-family: var(--font-sans);
			box-sizing: border-box;
		}
		[data-testid='theme-preview-scope'] *,
		[data-testid='theme-preview-scope'] *::before,
		[data-testid='theme-preview-scope'] *::after {
			box-sizing: border-box;
			text-transform: none;
			letter-spacing: normal;
		}
	`,
	template: `
		<div
			#previewScope
			data-testid="theme-preview-scope"
			[class.dark]="mode() === 'dark'"
			role="region"
			aria-label="Live theme preview"
		>
			<hdl-theme-components-showcase />
		</div>
	`,
})
export class ThemePreviewComponent {
	readonly config = input.required<ThemeConfig>();
	readonly mode = input.required<'light' | 'dark'>();

	private readonly renderer = inject(Renderer2);
	private readonly scopeRef = viewChild<ElementRef<HTMLElement>>('previewScope');

	private styleEl: HTMLStyleElement | null = null;

	readonly scopedCSS = computed(() =>
		generateThemeCSS(this.config(), { scopeSelector: '[data-testid="theme-preview-scope"]' }),
	);

	constructor() {
		effect(() => {
			const css = this.scopedCSS();
			const scopeEl = this.scopeRef()?.nativeElement;
			if (!scopeEl) return;

			if (!this.styleEl) {
				// Re-use SSR-rendered style element if present (avoids duplicate during hydration)
				const existing = scopeEl.querySelector('style');
				if (existing) {
					this.styleEl = existing;
				} else {
					const el: unknown = this.renderer.createElement('style');
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Renderer2.createElement('style') returns HTMLStyleElement
					this.styleEl = el as HTMLStyleElement;
					this.renderer.appendChild(scopeEl, this.styleEl);
				}
			}
			this.styleEl.textContent = css;
		});
	}
}

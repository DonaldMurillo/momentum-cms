/**
 * Typography Controls Component
 *
 * Font family selectors for sans, serif, and monospace fonts.
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import type { ThemeStyleProps } from '../theme-editor.types';

interface FontOption {
	label: string;
	value: string;
}

const SANS_OPTIONS: FontOption[] = [
	{
		label: 'System Default',
		value:
			"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
	},
	{ label: 'Inter', value: "'Inter', sans-serif" },
	{ label: 'Roboto', value: "'Roboto', sans-serif" },
	{ label: 'Open Sans', value: "'Open Sans', sans-serif" },
	{ label: 'Lato', value: "'Lato', sans-serif" },
	{ label: 'Poppins', value: "'Poppins', sans-serif" },
];

const SERIF_OPTIONS: FontOption[] = [
	{ label: 'System Default', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
	{ label: 'Merriweather', value: "'Merriweather', serif" },
	{ label: 'Playfair Display', value: "'Playfair Display', serif" },
	{ label: 'Lora', value: "'Lora', serif" },
];

const MONO_OPTIONS: FontOption[] = [
	{
		label: 'System Default',
		value:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
	},
	{ label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
	{ label: 'Fira Code', value: "'Fira Code', monospace" },
	{ label: 'Source Code Pro', value: "'Source Code Pro', monospace" },
];

@Component({
	selector: 'hdl-theme-typography-controls',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<h2 class="text-sm font-medium text-foreground mb-3">Typography</h2>
		<div class="space-y-3">
			<label class="block">
				<span class="text-xs text-muted-foreground mb-1 block">Sans-serif</span>
				<select
					class="w-full text-xs bg-background border border-input rounded px-2 py-1.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					#sansSelect
					(change)="onFontChange('font-sans', sansSelect.value)"
				>
					@for (opt of sansOptions; track opt.label) {
						<option [value]="opt.value" [selected]="styles()['font-sans'] === opt.value">
							{{ opt.label }}
						</option>
					}
				</select>
			</label>
			<label class="block">
				<span class="text-xs text-muted-foreground mb-1 block">Serif</span>
				<select
					class="w-full text-xs bg-background border border-input rounded px-2 py-1.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					#serifSelect
					(change)="onFontChange('font-serif', serifSelect.value)"
				>
					@for (opt of serifOptions; track opt.label) {
						<option [value]="opt.value" [selected]="styles()['font-serif'] === opt.value">
							{{ opt.label }}
						</option>
					}
				</select>
			</label>
			<label class="block">
				<span class="text-xs text-muted-foreground mb-1 block">Monospace</span>
				<select
					class="w-full text-xs bg-background border border-input rounded px-2 py-1.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					#monoSelect
					(change)="onFontChange('font-mono', monoSelect.value)"
				>
					@for (opt of monoOptions; track opt.label) {
						<option [value]="opt.value" [selected]="styles()['font-mono'] === opt.value">
							{{ opt.label }}
						</option>
					}
				</select>
			</label>
		</div>
	`,
})
export class TypographyControlsComponent {
	readonly styles = input.required<ThemeStyleProps>();
	readonly styleChange = output<{ key: keyof ThemeStyleProps; value: string }>();

	readonly sansOptions = SANS_OPTIONS;
	readonly serifOptions = SERIF_OPTIONS;
	readonly monoOptions = MONO_OPTIONS;

	onFontChange(key: keyof ThemeStyleProps, value: string): void {
		this.styleChange.emit({ key, value });
	}
}

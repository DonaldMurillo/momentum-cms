/**
 * Color Section Component
 *
 * Renders grouped color pairs (background + foreground) for the theme editor.
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { ColorPickerComponent } from './color-picker.component';
import type { ThemeStyleProps } from '../theme-editor.types';
import { COLOR_PAIRS } from '../theme-editor.types';

@Component({
	selector: 'hdl-theme-color-section',
	imports: [ColorPickerComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block', '[attr.data-testid]': '"theme-colors"' },
	template: `
		<h2 class="text-sm font-medium text-foreground mb-3">Colors</h2>
		<div class="space-y-3">
			@for (pair of colorPairs; track pair.label) {
				<div class="space-y-1.5">
					<div class="text-xs font-medium text-muted-foreground">{{ pair.label }}</div>
					<div class="grid gap-2" [class]="pair.fg ? 'grid-cols-2' : 'grid-cols-1'">
						<hdl-theme-color-picker
							[label]="'Background'"
							[value]="styles()[pair.bg] ?? ''"
							[testId]="pair.bg"
							(valueChange)="onColorChange(pair.bg, $event)"
						/>
						@if (pair.fg) {
							<hdl-theme-color-picker
								[label]="'Foreground'"
								[value]="styles()[pair.fg] ?? ''"
								[testId]="pair.fg"
								(valueChange)="onColorChange(pair.fg, $event)"
							/>
						}
					</div>
				</div>
			}
		</div>
	`,
})
export class ColorSectionComponent {
	readonly styles = input.required<ThemeStyleProps>();
	readonly colorChange = output<{ key: keyof ThemeStyleProps; value: string }>();

	readonly colorPairs = COLOR_PAIRS;

	onColorChange(key: keyof ThemeStyleProps, value: string): void {
		this.colorChange.emit({ key, value });
	}
}

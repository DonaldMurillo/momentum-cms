/**
 * Visual Controls Component
 *
 * Border radius slider and shadow controls.
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import type { ThemeStyleProps } from '../theme-editor.types';

@Component({
	selector: 'hdl-theme-visual-controls',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<h2 class="text-sm font-medium text-foreground mb-3">Visuals</h2>
		<div class="space-y-4">
			<!-- Border Radius -->
			<label class="block">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-muted-foreground">Border Radius</span>
					<span class="text-xs font-mono text-muted-foreground">{{ styles().radius }}</span>
				</div>
				<input
					#radiusInput
					type="range"
					class="w-full accent-primary"
					min="0"
					max="1.5"
					step="0.125"
					[value]="parseNum(styles().radius)"
					(input)="styleChange.emit({ key: 'radius', value: radiusInput.value + 'rem' })"
				/>
			</label>

			<!-- Shadow Opacity -->
			<label class="block">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-muted-foreground">Shadow Opacity</span>
					<span class="text-xs font-mono text-muted-foreground">{{
						styles()['shadow-opacity']
					}}</span>
				</div>
				<input
					#opacityInput
					type="range"
					class="w-full accent-primary"
					min="0"
					max="0.5"
					step="0.05"
					[value]="styles()['shadow-opacity']"
					(input)="styleChange.emit({ key: 'shadow-opacity', value: opacityInput.value })"
				/>
			</label>

			<!-- Shadow Blur -->
			<label class="block">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-muted-foreground">Shadow Blur</span>
					<span class="text-xs font-mono text-muted-foreground">{{ styles()['shadow-blur'] }}</span>
				</div>
				<input
					#blurInput
					type="range"
					class="w-full accent-primary"
					min="0"
					max="20"
					step="1"
					[value]="parseNum(styles()['shadow-blur'])"
					(input)="styleChange.emit({ key: 'shadow-blur', value: blurInput.value + 'px' })"
				/>
			</label>

			<!-- Letter Spacing -->
			<label class="block">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs text-muted-foreground">Letter Spacing</span>
					<span class="text-xs font-mono text-muted-foreground">{{
						styles()['letter-spacing']
					}}</span>
				</div>
				<input
					#spacingInput
					type="range"
					class="w-full accent-primary"
					min="-0.05"
					max="0.2"
					step="0.01"
					[value]="parseNum(styles()['letter-spacing'])"
					(input)="styleChange.emit({ key: 'letter-spacing', value: spacingInput.value + 'em' })"
				/>
			</label>
		</div>
	`,
})
export class VisualControlsComponent {
	readonly styles = input.required<ThemeStyleProps>();
	readonly styleChange = output<{ key: keyof ThemeStyleProps; value: string }>();

	parseNum(val: string): number {
		return parseFloat(val) || 0;
	}
}

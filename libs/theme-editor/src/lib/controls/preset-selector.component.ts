/**
 * Preset Selector Component
 *
 * Grid of preset theme buttons with visual previews.
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import type { ThemePreset } from '../theme-editor.types';

@Component({
	selector: 'hdl-theme-preset-selector',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<h2 class="text-sm font-medium text-foreground mb-3">Presets</h2>
		<div class="grid grid-cols-2 gap-2" role="group" aria-label="Theme presets">
			@for (preset of presets(); track preset.id) {
				<button
					type="button"
					class="flex flex-col items-start gap-1 p-2 rounded border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					[class]="
						selectedId() === preset.id
							? 'border-primary bg-primary/5'
							: 'border-border hover:border-primary/50'
					"
					[attr.aria-pressed]="selectedId() === preset.id"
					(click)="presetSelect.emit(preset.id)"
				>
					<span class="text-xs font-medium text-foreground">{{ preset.name }}</span>
					<span class="text-xs text-muted-foreground leading-tight">{{ preset.description }}</span>
				</button>
			}
		</div>
	`,
})
export class PresetSelectorComponent {
	readonly presets = input.required<ThemePreset[]>();
	readonly selectedId = input.required<string>();
	readonly presetSelect = output<string>();
}

/**
 * Color Picker Component
 *
 * Displays a color swatch with a text input for OKLCH values.
 * Users can type oklch values directly or use the native color picker as a visual aid.
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
	selector: 'hdl-theme-color-picker',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'flex items-center gap-2' },
	template: `
		<button
			type="button"
			class="w-8 h-8 rounded border border-border shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			[style.background]="value()"
			[attr.aria-label]="'Pick color for ' + label()"
			aria-haspopup="dialog"
			(click)="colorInput.click()"
		></button>
		<input
			#colorInput
			type="color"
			class="sr-only"
			tabindex="-1"
			[attr.aria-label]="'Color input for ' + label()"
			(input)="onNativeColorChange(colorInput.value)"
		/>
		<div class="flex flex-col gap-0.5 min-w-0 flex-1">
			<span class="text-xs text-muted-foreground truncate" [id]="'label-' + testId()">{{
				label()
			}}</span>
			<input
				#textInput
				type="text"
				class="w-full text-xs bg-transparent border border-input rounded px-2 py-1 font-mono text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				[value]="value()"
				[attr.data-testid]="'color-' + testId()"
				[attr.aria-label]="label() + ' color value'"
				[attr.aria-describedby]="'hint-' + testId()"
				(keydown.enter)="onTextInput(textInput.value)"
				(blur)="onTextInput(textInput.value)"
			/>
			<span class="sr-only" [id]="'hint-' + testId()"
				>Enter an OKLCH color value, e.g. oklch(0.5 0.2 250)</span
			>
		</div>
	`,
})
export class ColorPickerComponent {
	readonly label = input.required<string>();
	readonly value = input.required<string>();
	readonly testId = input<string>('');
	readonly valueChange = output<string>();

	onTextInput(val: string): void {
		const trimmed = val.trim();
		if (trimmed && trimmed !== this.value()) {
			this.valueChange.emit(trimmed);
		}
	}

	onNativeColorChange(hex: string): void {
		this.valueChange.emit(hex);
	}
}

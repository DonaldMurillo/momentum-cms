import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from '@angular/core';
import { HdlToggleGroup } from './toggle-group.component';

@Component({
	selector: 'hdl-toggle-item',
	host: {
		'[attr.data-slot]': '"toggle-item"',
		'[attr.data-state]': 'pressed() ? "on" : "off"',
		'[attr.data-disabled]': 'disabled() || toggleGroup.disabled() ? "true" : null',
		role: 'button',
		'[attr.tabindex]': 'tabIndex()',
		'[attr.aria-pressed]': 'pressed()',
		'[attr.aria-disabled]': 'disabled() || toggleGroup.disabled() || null',
		'(click)': 'toggle()',
		'(keydown.enter)': 'toggleFromKeyboard($event)',
		'(keydown.space)': 'toggleFromKeyboard($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToggleItem {
	protected readonly toggleGroup = inject(HdlToggleGroup);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

	readonly value = input.required<string>();
	readonly disabled = input(false);

	pressed(): boolean {
		return this.toggleGroup.isPressed(this.value());
	}

	tabIndex(): number {
		if (this.disabled() || this.toggleGroup.disabled()) {
			return -1;
		}

		return this.toggleGroup.isInitialTabStop(this.elementRef.nativeElement) ? 0 : -1;
	}

	toggle(): void {
		if (!this.disabled() && !this.toggleGroup.disabled()) {
			this.toggleGroup.toggleValue(this.value());
		}
	}

	toggleFromKeyboard(event: Event): void {
		event.preventDefault();
		this.toggle();
	}
}

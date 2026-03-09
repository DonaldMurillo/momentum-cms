import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { Option } from '@angular/aria/listbox';
import { HdlSelect } from './select.component';

@Component({
	selector: 'hdl-select-item',
	hostDirectives: [
		{
			directive: Option,
			inputs: ['value', 'label', 'disabled'],
		},
	],
	host: {
		'[attr.data-slot]': '"select-item"',
		'[attr.data-state]': 'option.selected() ? "selected" : "unselected"',
		'[attr.data-active]': 'option.active() ? "true" : null',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'(click)': 'selectItem()',
		'(keydown.enter)': 'selectItemFromKeyboard($event)',
		'(keydown.space)': 'selectItemFromKeyboard($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSelectItem {
	readonly option = inject<Option<string>>(Option);
	private readonly select = inject(HdlSelect);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

	readonly value = input.required<string>();
	readonly label = input<string>();
	readonly disabled = input(false);

	private readonly registrationEffect = effect((onCleanup) => {
		const value = this.value();
		const label = this.label() ?? this.elementRef.nativeElement.textContent?.trim() ?? value;
		untracked(() => this.select.registerItem(value, label));
		onCleanup(() => {
			untracked(() => this.select.unregisterItem(value));
		});
	});

	selectItem(): void {
		if (!this.disabled()) {
			this.select.value.set(this.value());
			this.select.hide();
			this.select.focusTrigger();
		}
	}

	selectItemFromKeyboard(event: Event): void {
		event.preventDefault();
		this.selectItem();
	}
}

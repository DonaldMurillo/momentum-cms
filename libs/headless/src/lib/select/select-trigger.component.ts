import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { HdlSelect } from './select.component';

@Component({
	selector: 'hdl-select-trigger',
	host: {
		'[attr.data-slot]': '"select-trigger"',
		'[attr.data-state]': 'select.open() ? "open" : "closed"',
		'[attr.data-disabled]': 'select.disabled() ? "true" : null',
		role: 'button',
		'[attr.tabindex]': 'select.disabled() ? -1 : 0',
		'[attr.aria-haspopup]': '"listbox"',
		'[attr.aria-expanded]': 'select.open()',
		'[attr.aria-controls]': 'select.contentId()',
		'(click)': 'select.toggle()',
		'(keydown.enter)': 'openFromKeyboard($event)',
		'(keydown.space)': 'openFromKeyboard($event)',
		'(keydown.arrowdown)': 'openFromKeyboard($event)',
		'(keydown.arrowup)': 'openFromKeyboard($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSelectTrigger {
	protected readonly select = inject(HdlSelect);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

	constructor() {
		this.select.registerTrigger(this.elementRef.nativeElement);
	}

	openFromKeyboard(event: Event): void {
		event.preventDefault();
		this.select.show();
	}
}

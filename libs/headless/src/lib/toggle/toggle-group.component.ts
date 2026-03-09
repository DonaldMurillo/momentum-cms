import { DOCUMENT } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	inject,
	input,
	model,
} from '@angular/core';

@Component({
	selector: 'hdl-toggle-group',
	host: {
		'[attr.data-slot]': '"toggle-group"',
		'[attr.data-orientation]': 'orientation()',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'[attr.data-multiple]': 'multiple() ? "true" : null',
		role: 'group',
		'(keydown)': 'onKeydown($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToggleGroup {
	private readonly doc = inject(DOCUMENT);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

	readonly disabled = input(false);
	readonly multiple = input(false);
	readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
	readonly value = model<string | null>(null);
	readonly values = model<string[]>([]);

	isPressed(value: string): boolean {
		return this.multiple() ? this.values().includes(value) : this.value() === value;
	}

	isInitialTabStop(item: HTMLElement): boolean {
		if (this.disabled()) {
			return false;
		}

		const enabledItems = this.getEnabledItems();
		const selected = enabledItems.find(
			(candidate) => candidate.getAttribute('aria-pressed') === 'true',
		);
		return (selected ?? enabledItems[0]) === item;
	}

	toggleValue(value: string): void {
		if (this.disabled()) return;

		if (this.multiple()) {
			const current = this.values();
			this.values.set(
				current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
			);
			return;
		}

		this.value.set(this.value() === value ? null : value);
	}

	onKeydown(event: KeyboardEvent): void {
		const enabledItems = this.getEnabledItems();
		if (this.disabled() || enabledItems.length === 0) return;

		const forwardKeys = this.orientation() === 'horizontal' ? ['ArrowRight'] : ['ArrowDown'];
		const backwardKeys = this.orientation() === 'horizontal' ? ['ArrowLeft'] : ['ArrowUp'];

		const currentIndex = enabledItems.findIndex((item) => item === this.doc.activeElement);
		let nextIndex = -1;

		if (forwardKeys.includes(event.key)) {
			event.preventDefault();
			nextIndex =
				currentIndex >= 0 && currentIndex < enabledItems.length - 1 ? currentIndex + 1 : 0;
		} else if (backwardKeys.includes(event.key)) {
			event.preventDefault();
			nextIndex = currentIndex > 0 ? currentIndex - 1 : enabledItems.length - 1;
		}

		if (nextIndex >= 0) {
			enabledItems[nextIndex].focus();
		}
	}

	private getEnabledItems(): HTMLElement[] {
		return Array.from(
			this.elementRef.nativeElement.querySelectorAll<HTMLElement>(
				'[data-slot="toggle-item"]:not([aria-disabled="true"])',
			),
		);
	}
}

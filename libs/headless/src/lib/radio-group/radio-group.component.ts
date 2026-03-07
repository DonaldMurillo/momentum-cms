import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	inject,
	input,
	model,
} from '@angular/core';

@Component({
	selector: 'hdl-radio-group',
	host: {
		role: 'radiogroup',
		'[attr.aria-disabled]': 'disabled() || null',
		'(keydown)': 'onKeydown($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlRadioGroup {
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

	readonly value = model('');
	readonly disabled = input(false);

	isInitialTabStop(item: HTMLElement): boolean {
		if (this.disabled() || this.value()) {
			return false;
		}

		return this.getEnabledRadios()[0] === item;
	}

	onKeydown(event: KeyboardEvent): void {
		if (this.disabled()) return;

		const radios = this.getEnabledRadios();
		if (radios.length === 0) return;

		const currentIndex = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
		let newIndex: number;

		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				event.preventDefault();
				newIndex = currentIndex < radios.length - 1 ? currentIndex + 1 : 0;
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				event.preventDefault();
				newIndex = currentIndex > 0 ? currentIndex - 1 : radios.length - 1;
				break;
			default:
				return;
		}

		radios[newIndex].focus();
		radios[newIndex].click();
	}

	private getEnabledRadios(): HTMLElement[] {
		return Array.from(
			this.elementRef.nativeElement.querySelectorAll<HTMLElement>(
				'[role="radio"]:not([aria-disabled="true"])',
			),
		);
	}
}

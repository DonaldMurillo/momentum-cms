import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	inject,
	input,
	model,
	signal,
} from '@angular/core';

@Component({
	selector: 'hdl-radio-group',
	host: {
		'[attr.data-slot]': '"radio-group"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
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

	private readonly registeredValues = signal(new Set<string>());

	registerItemValue(value: string): void {
		this.registeredValues.update((s) => {
			const next = new Set(s);
			next.add(value);
			return next;
		});
	}

	unregisterItemValue(value: string): void {
		this.registeredValues.update((s) => {
			const next = new Set(s);
			next.delete(value);
			return next;
		});
	}

	isInitialTabStop(item: HTMLElement): boolean {
		if (this.disabled()) {
			return false;
		}

		// If value matches a registered item, that item handles tabindex=0 via isSelected().
		const val = this.value();
		if (val && this.registeredValues().has(val)) {
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

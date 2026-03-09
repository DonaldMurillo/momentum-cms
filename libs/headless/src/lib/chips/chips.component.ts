import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
	selector: 'hdl-chips',
	host: {
		'[attr.data-slot]': '"chips"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'[attr.data-empty]': 'values().length === 0 ? "true" : null',
		role: 'list',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlChips {
	readonly values = model<string[]>([]);
	readonly disabled = input(false);
	readonly allowDuplicates = input(false);
	readonly separatorKeys = input<string[]>(['Enter', ',']);

	addValue(rawValue: string): boolean {
		if (this.disabled()) {
			return false;
		}

		const value = rawValue.trim();
		if (!value) {
			return false;
		}

		if (!this.allowDuplicates() && this.values().includes(value)) {
			return false;
		}

		this.values.set([...this.values(), value]);
		return true;
	}

	removeValue(value: string): void {
		if (this.disabled()) {
			return;
		}

		const index = this.values().indexOf(value);
		if (index === -1) {
			return;
		}

		const nextValues = [...this.values()];
		nextValues.splice(index, 1);
		this.values.set(nextValues);
	}

	removeLastValue(): void {
		if (this.disabled() || this.values().length === 0) {
			return;
		}

		this.values.set(this.values().slice(0, -1));
	}

	isSeparatorKey(key: string): boolean {
		return this.separatorKeys().includes(key);
	}
}

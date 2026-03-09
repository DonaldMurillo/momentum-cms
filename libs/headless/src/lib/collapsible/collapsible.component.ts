import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
	selector: 'hdl-collapsible',
	host: {
		'[attr.data-slot]': '"collapsible"',
		'[attr.data-state]': 'open() ? "open" : "closed"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCollapsible {
	readonly open = model(false);
	readonly disabled = input(false);
	private contentIdValue: string | null = null;

	contentId(): string | null {
		return this.contentIdValue;
	}

	registerContent(id: string): void {
		this.contentIdValue = id;
	}

	unregisterContent(id: string): void {
		if (this.contentIdValue === id) {
			this.contentIdValue = null;
		}
	}

	toggle(): void {
		if (!this.disabled()) {
			this.open.update((value) => !value);
		}
	}
}

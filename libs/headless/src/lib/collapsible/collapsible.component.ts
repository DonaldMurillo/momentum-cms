import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';

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
	readonly contentId = signal<string | null>(null);

	registerContent(id: string): void {
		this.contentId.set(id);
	}

	unregisterContent(id: string): void {
		if (this.contentId() === id) {
			this.contentId.set(null);
		}
	}

	toggle(): void {
		if (!this.disabled()) {
			this.open.update((value) => !value);
		}
	}
}

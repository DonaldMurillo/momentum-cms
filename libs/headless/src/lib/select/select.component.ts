import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

@Component({
	selector: 'hdl-select',
	host: {
		'[attr.data-slot]': '"select"',
		'[attr.data-state]': 'open() ? "open" : "closed"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'[attr.data-required]': 'required() ? "true" : null',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSelect {
	readonly value = model<string | null>(null);
	readonly disabled = input(false);
	readonly required = input(false);

	readonly open = signal(false);
	private readonly labels = signal<Record<string, string>>({});
	private triggerElement: HTMLElement | null = null;
	readonly contentId = signal<string | null>(null);

	readonly selectedLabel = computed(() => {
		const value = this.value();
		return value ? (this.labels()[value] ?? value) : null;
	});

	registerItem(value: string, label: string): void {
		this.labels.update((current) => ({ ...current, [value]: label }));
	}

	unregisterItem(value: string): void {
		this.labels.update((current) => {
			const next = { ...current };
			delete next[value];
			return next;
		});
	}

	registerTrigger(element: HTMLElement): void {
		this.triggerElement = element;
	}

	unregisterTrigger(element: HTMLElement): void {
		if (this.triggerElement === element) {
			this.triggerElement = null;
		}
	}

	registerContent(id: string): void {
		this.contentId.set(id);
	}

	unregisterContent(id: string): void {
		if (this.contentId() === id) {
			this.contentId.set(null);
		}
	}

	focusTrigger(): void {
		this.triggerElement?.focus();
	}

	toggle(): void {
		if (!this.disabled()) {
			this.open.update((value) => !value);
		}
	}

	show(): void {
		if (!this.disabled()) {
			this.open.set(true);
		}
	}

	hide(): void {
		this.open.set(false);
	}
}

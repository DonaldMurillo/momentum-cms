import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

let nextListId = 0;

export interface CommandItemEntry {
	id: string;
	value: string;
	isVisible: () => boolean;
	isDisabled: () => boolean;
	element: HTMLElement;
}

@Component({
	selector: 'hdl-command',
	host: {
		'[attr.data-slot]': '"command"',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCommand {
	readonly query = model('');
	readonly value = model<string | null>(null);
	readonly disabled = input(false);
	readonly filterMode = input<'auto' | 'manual'>('auto');
	readonly listId = `hdl-command-list-${nextListId++}`;

	private readonly items = signal<CommandItemEntry[]>([]);
	readonly activeItemId = signal<string | null>(null);

	readonly visibleItemCount = computed(
		() => this.items().filter((item) => item.isVisible() && !item.isDisabled()).length,
	);

	readonly visibleItems = computed(() =>
		this.items().filter((item) => item.isVisible() && !item.isDisabled()),
	);

	registerItem(entry: CommandItemEntry): void {
		this.items.update((current) => [...current.filter((item) => item.id !== entry.id), entry]);
	}

	unregisterItem(id: string): void {
		this.items.update((current) => current.filter((item) => item.id !== id));
		if (this.activeItemId() === id) {
			this.activeItemId.set(null);
		}
	}

	navigateNext(): void {
		const visible = this.visibleItems();
		if (visible.length === 0) return;
		const activeId = this.activeItemId();
		const currentIndex = activeId ? visible.findIndex((item) => item.id === activeId) : -1;
		const nextIndex = currentIndex + 1 >= visible.length ? 0 : currentIndex + 1;
		this.activeItemId.set(visible[nextIndex].id);
		this.scrollActiveIntoView(visible[nextIndex].element);
	}

	navigatePrev(): void {
		const visible = this.visibleItems();
		if (visible.length === 0) return;
		const activeId = this.activeItemId();
		const currentIndex = activeId ? visible.findIndex((item) => item.id === activeId) : -1;
		const prevIndex = currentIndex <= 0 ? visible.length - 1 : currentIndex - 1;
		this.activeItemId.set(visible[prevIndex].id);
		this.scrollActiveIntoView(visible[prevIndex].element);
	}

	navigateFirst(): void {
		const visible = this.visibleItems();
		if (visible.length === 0) return;
		this.activeItemId.set(visible[0].id);
		this.scrollActiveIntoView(visible[0].element);
	}

	navigateLast(): void {
		const visible = this.visibleItems();
		if (visible.length === 0) return;
		const last = visible[visible.length - 1];
		this.activeItemId.set(last.id);
		this.scrollActiveIntoView(last.element);
	}

	selectActive(): void {
		const activeId = this.activeItemId();
		if (!activeId) return;
		const item = this.visibleItems().find((i) => i.id === activeId);
		if (item) {
			this.value.set(item.value);
		}
	}

	private scrollActiveIntoView(element: HTMLElement): void {
		element.scrollIntoView?.({ block: 'nearest' });
	}
}

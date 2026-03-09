import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { HdlCommand } from './command.component';

let nextId = 0;

@Component({
	selector: 'hdl-command-item',
	host: {
		role: 'option',
		'[attr.data-slot]': '"command-item"',
		'[attr.data-state]': 'selected() ? "selected" : "unselected"',
		'[attr.data-active]': 'active() ? "true" : null',
		'[attr.data-disabled]': 'disabled() ? "true" : null',
		'[attr.aria-selected]': 'selected()',
		'[attr.aria-disabled]': 'disabled()',
		'[attr.hidden]': 'visible() ? null : ""',
		'[attr.id]': 'id',
		'(click)': 'selectItem()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCommandItem {
	private readonly command = inject(HdlCommand);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

	readonly id = `hdl-command-item-${nextId++}`;
	readonly value = input.required<string>();
	readonly label = input<string>();
	readonly keywords = input<string[]>([]);
	readonly disabled = input(false);

	readonly visible = computed(() => {
		if (this.command.filterMode() === 'manual') return true;
		const query = this.command.query().trim().toLowerCase();
		if (!query) return true;

		const label = this.label() ?? this.elementRef.nativeElement.textContent?.trim() ?? this.value();
		const haystack = [label, this.value(), ...this.keywords()].join(' ').toLowerCase();
		return haystack.includes(query);
	});

	readonly active = computed(() => this.command.activeItemId() === this.id);
	readonly selected = computed(() => this.command.value() === this.value());

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id;
		const value = this.value();
		const element = this.elementRef.nativeElement;
		untracked(() =>
			this.command.registerItem({
				id,
				value,
				isVisible: () => this.visible(),
				isDisabled: () => this.disabled(),
				element,
			}),
		);
		onCleanup(() => {
			untracked(() => this.command.unregisterItem(id));
		});
	});

	selectItem(): void {
		if (!this.disabled() && this.visible()) {
			this.command.value.set(this.value());
		}
	}
}

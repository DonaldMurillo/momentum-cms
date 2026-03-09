import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	effect,
	inject,
	input,
	untracked,
} from '@angular/core';
import { Listbox } from '@angular/aria/listbox';
import { HdlSelect } from './select.component';

let nextId = 0;

@Component({
	selector: 'hdl-select-content',
	hostDirectives: [
		{
			directive: Listbox,
			inputs: ['wrap', 'focusMode', 'selectionMode', 'disabled', 'values'],
		},
	],
	host: {
		'[attr.data-slot]': '"select-content"',
		'[attr.data-state]': 'select.open() ? "open" : "closed"',
		'[attr.data-disabled]': 'select.disabled() ? "true" : null',
		'[attr.hidden]': 'select.open() ? null : ""',
		'[attr.id]': 'id()',
		'(keydown.escape)': 'closeFromKeyboard($event)',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlSelectContent {
	protected readonly select = inject(HdlSelect);
	private readonly listbox = inject<Listbox<string>>(Listbox);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

	readonly id = input(`hdl-select-content-${nextId++}`);
	readonly wrap = input(true);
	readonly focusMode = input<'roving' | 'activedescendant'>('roving');
	readonly selectionMode = input<'follow' | 'explicit'>('explicit');
	readonly disabled = input(false);
	readonly values = this.listbox.values;

	private readonly registrationEffect = effect((onCleanup) => {
		const id = this.id();
		untracked(() => this.select.registerContent(id));
		onCleanup(() => {
			untracked(() => this.select.unregisterContent(id));
		});
	});

	private readonly syncRootToListbox = effect(() => {
		const selected = this.select.value();
		const nextValues = selected ? [selected] : [];
		if (this.listbox.values().join('|') !== nextValues.join('|')) {
			untracked(() => this.listbox.values.set(nextValues));
		}
	});

	private readonly syncListboxToRoot = effect(() => {
		const selected = this.listbox.values()[0] ?? null;
		if (selected !== this.select.value()) {
			untracked(() => {
				this.select.value.set(selected);
				if (selected !== null) {
					this.select.hide();
					this.select.focusTrigger();
				}
			});
		}
	});

	private readonly focusEffect = effect(() => {
		if (!this.select.open()) return;

		queueMicrotask(() => {
			const target = this.elementRef.nativeElement.querySelector<HTMLElement>(
				'[role="option"][aria-selected="true"], [role="option"]:not([aria-disabled="true"])',
			);
			target?.focus();
		});
	});

	closeFromKeyboard(event: Event): void {
		event.preventDefault();
		this.select.hide();
		this.select.focusTrigger();
	}
}

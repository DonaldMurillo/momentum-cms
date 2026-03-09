import { Directive, inject } from '@angular/core';
import { HdlCommand } from './command.component';

@Directive({
	selector: 'input[hdlCommandInput], textarea[hdlCommandInput]',
	host: {
		'[attr.data-slot]': '"command-input"',
		role: 'combobox',
		'aria-autocomplete': 'list',
		'[attr.aria-controls]': 'command.listId',
		'[attr.aria-expanded]': '"true"',
		'[attr.aria-activedescendant]': 'command.activeItemId()',
		'[attr.data-disabled]': 'command.disabled() ? "true" : null',
		'(input)': 'onInput($event)',
		'(keydown)': 'onKeydown($event)',
	},
})
export class HdlCommandInput {
	protected readonly command = inject(HdlCommand);

	onInput(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
			this.command.query.set(target.value);
			this.command.activeItemId.set(null);
		}
	}

	onKeydown(event: Event): void {
		if (!(event instanceof KeyboardEvent)) return;
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				this.command.navigateNext();
				break;
			case 'ArrowUp':
				event.preventDefault();
				this.command.navigatePrev();
				break;
			case 'Home':
				if (event.metaKey || event.ctrlKey) {
					event.preventDefault();
					this.command.navigateFirst();
				}
				break;
			case 'End':
				if (event.metaKey || event.ctrlKey) {
					event.preventDefault();
					this.command.navigateLast();
				}
				break;
			case 'Enter':
				event.preventDefault();
				this.command.selectActive();
				break;
		}
	}
}

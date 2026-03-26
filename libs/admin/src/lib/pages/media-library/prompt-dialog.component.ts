import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DialogRef, DIALOG_DATA, Button } from '@momentumcms/ui';

let dialogIdCounter = 0;

/** Data passed to the PromptDialog */
export interface PromptDialogData {
	title: string;
	label: string;
	placeholder?: string;
	confirmText?: string;
}

/** Data passed to the SelectDialog */
export interface SelectDialogData {
	title: string;
	label: string;
	options: Array<{ id: string; name: string }>;
	confirmText?: string;
}

/**
 * Modern dialog replacement for `window.prompt()`.
 * Returns the entered string or undefined if cancelled.
 */
@Component({
	selector: 'mcms-prompt-dialog',
	imports: [Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="p-6 max-w-md" role="dialog" aria-modal="true">
			<h2 class="text-lg font-semibold mb-4">{{ data.title }}</h2>
			<label class="block text-sm font-medium text-muted-foreground mb-1.5" [attr.for]="inputId">
				{{ data.label }}
			</label>
			<input
				[id]="inputId"
				#inputEl
				type="text"
				class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				[placeholder]="data.placeholder ?? ''"
				[value]="value()"
				(input)="value.set(inputEl.value)"
				(keydown.enter)="submit()"
				(keydown.escape)="cancel()"
			/>
			<div class="flex justify-end gap-2 mt-4">
				<button mcms-button variant="outline" (click)="cancel()">Cancel</button>
				<button mcms-button (click)="submit()" [disabled]="!value().trim()">
					{{ data.confirmText ?? 'Create' }}
				</button>
			</div>
		</div>
	`,
})
export class PromptDialog {
	readonly dialogRef = inject(DialogRef<string | undefined>);
	readonly data = inject<PromptDialogData>(DIALOG_DATA);
	readonly value = signal('');
	readonly inputId = `mcms-prompt-dialog-input-${dialogIdCounter++}`;

	submit(): void {
		const v = this.value().trim();
		if (v) this.dialogRef.close(v);
	}

	cancel(): void {
		this.dialogRef.close(undefined);
	}
}

/**
 * Modern dialog replacement for `window.prompt()` when selecting from a list.
 * Returns the selected option's id or undefined if cancelled.
 */
@Component({
	selector: 'mcms-select-dialog',
	imports: [Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="p-6 max-w-md" role="dialog" aria-modal="true">
			<h2 class="text-lg font-semibold mb-4">{{ data.title }}</h2>
			<label class="block text-sm font-medium text-muted-foreground mb-1.5" [attr.for]="selectId">
				{{ data.label }}
			</label>
			<select
				[id]="selectId"
				class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				(change)="onSelect($event)"
			>
				<option value="">Select...</option>
				@for (opt of data.options; track opt.id) {
					<option [value]="opt.id">{{ opt.name }}</option>
				}
			</select>
			<div class="flex justify-end gap-2 mt-4">
				<button mcms-button variant="outline" (click)="cancel()">Cancel</button>
				<button mcms-button (click)="submit()" [disabled]="!selectedId()">
					{{ data.confirmText ?? 'Confirm' }}
				</button>
			</div>
		</div>
	`,
})
export class SelectDialog {
	readonly dialogRef = inject(DialogRef<string | undefined>);
	readonly data = inject<SelectDialogData>(DIALOG_DATA);
	readonly selectedId = signal('');
	readonly selectId = `mcms-select-dialog-select-${dialogIdCounter++}`;

	onSelect(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLSelectElement) {
			this.selectedId.set(target.value);
		}
	}

	submit(): void {
		const id = this.selectedId();
		if (id) this.dialogRef.close(id);
	}

	cancel(): void {
		this.dialogRef.close(undefined);
	}
}

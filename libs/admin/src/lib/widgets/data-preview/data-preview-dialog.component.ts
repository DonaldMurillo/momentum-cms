import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	Button,
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogClose,
	DialogRef,
	DIALOG_DATA,
	FieldDisplay,
} from '@momentumcms/ui';
import type { FieldDisplayType, FieldDisplayFieldMeta } from '@momentumcms/ui';

/** Data passed to the DataPreviewDialog. */
export interface DataPreviewDialogData {
	title: string;
	value: unknown;
	type: FieldDisplayType;
	fieldMeta: FieldDisplayFieldMeta[];
}

/**
 * Read-only dialog for previewing complex field data (group, array, JSON).
 */
@Component({
	selector: 'mcms-data-preview-dialog',
	imports: [
		Button,
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		FieldDisplay,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { style: 'display: block; width: 100%' },
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>{{ data.title }}</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<div class="max-h-[60vh] overflow-y-auto">
					<mcms-field-display
						[value]="data.value"
						[type]="data.type"
						[fieldMeta]="data.fieldMeta"
						[maxItems]="50"
					/>
				</div>
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button mcms-button variant="outline" mcmsDialogClose type="button">Close</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class DataPreviewDialog {
	readonly data = inject<DataPreviewDialogData>(DIALOG_DATA);
	private readonly dialogRef = inject(DialogRef);

	close(): void {
		this.dialogRef.close();
	}
}

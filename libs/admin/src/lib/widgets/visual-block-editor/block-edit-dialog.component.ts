/**
 * Block Edit Dialog
 *
 * Opens from the preview iframe's "Edit Block" overlay. Renders FieldRenderer
 * for each visible field of the selected block, using the parent form's signal
 * forms tree nodes so edits are reflected live in the preview.
 */

import { ChangeDetectionStrategy, Component, forwardRef, inject } from '@angular/core';
import type { BlockConfig, Field } from '@momentum-cms/core';
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
} from '@momentum-cms/ui';
import { getSubNode } from '../entity-form/entity-form.types';
import type { EntityFormMode } from '../entity-form/entity-form.types';
import { FieldRenderer } from '../entity-form/field-renderers/field-renderer.component';

/** Data passed to the BlockEditDialog via DIALOG_DATA. */
export interface BlockEditDialogData {
	blockConfig: BlockConfig;
	formNode: unknown;
	blockIndex: number;
	formTree: unknown;
	formModel: Record<string, unknown>;
	mode: EntityFormMode;
	path: string;
}

@Component({
	selector: 'mcms-block-edit-dialog',
	imports: [
		Button,
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		forwardRef(() => FieldRenderer),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { style: 'display: block; width: 100%' },
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>Edit {{ blockLabel }}</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<div class="space-y-4 max-h-[60vh] overflow-y-auto py-1">
					@for (field of visibleFields; track field.name) {
						<mcms-field-renderer
							[field]="field"
							[formNode]="getFieldNode(field.name)"
							[formTree]="data.formTree"
							[formModel]="data.formModel"
							[mode]="data.mode"
							[path]="getFieldPath(field.name)"
						/>
					}
				</div>
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button mcms-button variant="outline" mcmsDialogClose type="button">Done</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class BlockEditDialog {
	readonly data = inject<BlockEditDialogData>(DIALOG_DATA);
	private readonly dialogRef = inject(DialogRef);

	readonly blockLabel = this.data.blockConfig.labels?.singular || this.data.blockConfig.slug;

	readonly visibleFields: Field[] = this.data.blockConfig.fields.filter((f) => !f.admin?.hidden);

	getFieldNode(fieldName: string): unknown {
		const blockNode = getSubNode(this.data.formNode, this.data.blockIndex);
		return getSubNode(blockNode, fieldName);
	}

	getFieldPath(fieldName: string): string {
		return `${this.data.path}.${this.data.blockIndex}.${fieldName}`;
	}
}

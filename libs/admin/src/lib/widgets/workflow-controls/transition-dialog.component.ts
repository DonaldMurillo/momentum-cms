import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	Button,
	DIALOG_DATA,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRef,
	DialogTitle,
} from '@momentumcms/ui';

export interface TransitionDialogData {
	fromLabel: string;
	toLabel: string;
	toDescription?: string;
	willPublish?: boolean;
	willUnpublish?: boolean;
}

export type TransitionDialogResult = { comment: string } | undefined;

/** Mirrors MAX_COMMENT_LENGTH on the server handler. */
const MAX_COMMENT_LENGTH = 2000;

/**
 * Dialog confirming a workflow transition with an optional comment field.
 * Returns `{ comment }` when the user confirms, or `undefined` when cancelled.
 */
@Component({
	selector: 'mcms-transition-dialog',
	imports: [FormsModule, Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-dialog class="max-w-md">
			<mcms-dialog-header>
				<mcms-dialog-title> Move from {{ data.fromLabel }} → {{ data.toLabel }} </mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				@if (data.toDescription) {
					<p class="mb-3 text-sm text-muted-foreground">{{ data.toDescription }}</p>
				}
				@if (data.willPublish) {
					<p
						class="mb-3 rounded-md bg-success/10 px-3 py-2 text-sm text-success-foreground"
						role="note"
						data-testid="will-publish-note"
					>
						Entering this stage will <strong>publish</strong> the document.
					</p>
				}
				@if (data.willUnpublish) {
					<p
						class="mb-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground"
						role="note"
						data-testid="will-unpublish-note"
					>
						Entering this stage will <strong>unpublish</strong> the document.
					</p>
				}

				<label class="block text-sm font-medium mb-1" for="transition-comment">
					Comment <span class="text-muted-foreground font-normal">(optional)</span>
				</label>
				<textarea
					id="transition-comment"
					rows="3"
					[attr.maxlength]="maxCommentLength"
					data-testid="transition-comment-input"
					class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					[ngModel]="comment()"
					(ngModelChange)="comment.set($event)"
				></textarea>
				<p
					class="mt-1 text-xs text-muted-foreground text-right"
					data-testid="transition-comment-counter"
				>
					{{ comment().length }} / {{ maxCommentLength }}
				</p>
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button
					mcms-button
					variant="outline"
					size="sm"
					[disabled]="isSubmitting()"
					data-testid="transition-cancel"
					(click)="onCancel()"
				>
					Cancel
				</button>
				<button
					mcms-button
					variant="primary"
					size="sm"
					[disabled]="isSubmitting()"
					[attr.aria-busy]="isSubmitting() ? 'true' : null"
					data-testid="transition-confirm"
					(click)="onConfirm()"
				>
					Confirm
				</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class TransitionDialogComponent {
	readonly data = inject<TransitionDialogData>(DIALOG_DATA);
	private readonly dialogRef = inject<DialogRef<TransitionDialogResult>>(DialogRef);

	readonly comment = signal('');
	readonly maxCommentLength = MAX_COMMENT_LENGTH;
	/**
	 * Latches on first click so rapid double-clicks can't fire `close` twice
	 * before the dialog actually unmounts. Without this, the parent's
	 * `isUpdating` signal flips after the click resolves — a 30ms window
	 * is enough to fire two transitions on a slow connection.
	 */
	readonly isSubmitting = signal(false);
	readonly canConfirm = computed(() => !this.isSubmitting());

	onConfirm(): void {
		if (this.isSubmitting()) return;
		this.isSubmitting.set(true);
		this.dialogRef.close({ comment: this.comment() });
	}

	onCancel(): void {
		if (this.isSubmitting()) return;
		this.dialogRef.close(undefined);
	}
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	Button,
	DIALOG_DATA,
	DialogRef,
} from '@momentumcms/ui';

/**
 * Data passed to the schedule-publish dialog.
 */
export interface SchedulePublishDialogData {
	collectionLabel: string;
	/** Initial value for the picker, in `YYYY-MM-DDTHH:mm` local format. */
	initialValue?: string;
}

/**
 * Result returned via DialogService.afterClosed:
 * - string: ISO date selected by the user
 * - undefined: dialog dismissed
 */
export type SchedulePublishDialogResult = string | undefined;

/**
 * Dialog for picking a future date+time at which a draft document should
 * automatically publish. Returns the chosen ISO timestamp via afterClosed,
 * or undefined when the user cancels.
 *
 * Validation lives here so the parent component just hands back the ISO string:
 * - empty value blocks the Schedule button
 * - past dates block submission with an inline message
 */
@Component({
	selector: 'mcms-schedule-publish-dialog',
	imports: [FormsModule, Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-dialog class="max-w-md">
			<mcms-dialog-header>
				<mcms-dialog-title>Schedule publish</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<p class="mb-3 text-sm text-muted-foreground">
					Choose when this {{ data.collectionLabel.toLowerCase() }} should publish automatically.
				</p>
				<label class="block text-sm font-medium mb-1" for="schedule-publish-at"> Publish at </label>
				<input
					id="schedule-publish-at"
					data-testid="schedule-publish-at-input"
					type="datetime-local"
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
					[ngModel]="value()"
					(ngModelChange)="value.set($event)"
					[attr.aria-invalid]="errorMessage() !== null ? 'true' : null"
					[attr.aria-describedby]="hintId()"
				/>
				@if (errorMessage()) {
					<p
						id="schedule-publish-error"
						class="mt-2 text-sm text-destructive"
						role="alert"
						data-testid="schedule-publish-error"
					>
						{{ errorMessage() }}
					</p>
				} @else if (!value()) {
					<p id="schedule-publish-hint" class="mt-2 text-sm text-muted-foreground">
						Pick a future date and time.
					</p>
				}
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button
					mcms-button
					variant="ghost"
					data-testid="schedule-publish-cancel"
					(click)="onCancel()"
				>
					Cancel
				</button>
				<button
					mcms-button
					variant="primary"
					[disabled]="isInvalid()"
					data-testid="schedule-publish-confirm"
					(click)="onConfirm()"
				>
					Schedule
				</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class SchedulePublishDialogComponent {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DIALOG_DATA is generic InjectionToken<unknown>
	readonly data = inject(DIALOG_DATA) as SchedulePublishDialogData;
	private readonly dialogRef = inject<DialogRef<SchedulePublishDialogResult>>(DialogRef);

	readonly value = signal(this.data.initialValue ?? '');

	/** Date object derived from the picker value. Null if unparseable. */
	private readonly chosenDate = computed<Date | null>(() => {
		const raw = this.value();
		if (!raw) return null;
		const date = new Date(raw);
		return Number.isNaN(date.getTime()) ? null : date;
	});

	readonly errorMessage = computed<string | null>(() => {
		const date = this.chosenDate();
		if (!date) return null;
		if (date.getTime() <= Date.now()) {
			return 'Pick a future date and time.';
		}
		return null;
	});

	readonly isInvalid = computed<boolean>(() => {
		const date = this.chosenDate();
		return !date || this.errorMessage() !== null;
	});

	/** ID of the help/error element to associate with the input via aria-describedby. */
	readonly hintId = computed<string | null>(() => {
		if (this.errorMessage()) return 'schedule-publish-error';
		if (!this.value()) return 'schedule-publish-hint';
		return null;
	});

	onConfirm(): void {
		const date = this.chosenDate();
		if (!date || this.errorMessage()) return;
		this.dialogRef.close(date.toISOString());
	}

	onCancel(): void {
		this.dialogRef.close(undefined);
	}
}

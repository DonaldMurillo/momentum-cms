import { inject, Injectable } from '@angular/core';
import { DialogService } from '../dialog/dialog.service';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';
import type { ConfirmationConfig } from './confirmation-dialog.types';

/**
 * Service for showing confirmation dialogs.
 *
 * Usage:
 * ```typescript
 * // In your component
 * private confirmation = inject(ConfirmationService);
 *
 * async onDelete(): Promise<void> {
 *   const confirmed = await this.confirmation.confirm({
 *     title: 'Delete item?',
 *     description: 'This action cannot be undone.',
 *     confirmText: 'Delete',
 *     variant: 'destructive',
 *   });
 *
 *   if (confirmed) {
 *     // Proceed with deletion
 *   }
 * }
 *
 * // Or use the convenience method
 * async onDeleteItem(): Promise<void> {
 *   const confirmed = await this.confirmation.delete('this item');
 *   if (confirmed) {
 *     // Proceed
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
	private readonly dialog = inject(DialogService);

	/**
	 * Show a confirmation dialog.
	 * @returns Promise that resolves to true if confirmed, false if cancelled.
	 */
	confirm(config: ConfirmationConfig): Promise<boolean> {
		return new Promise((resolve) => {
			const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationConfig, boolean>(
				ConfirmationDialogComponent,
				{
					data: config,
					disableClose: true,
					width: '24rem',
				},
			);

			dialogRef.afterClosed.subscribe((confirmed) => {
				resolve(confirmed ?? false);
			});
		});
	}

	/**
	 * Show a delete confirmation dialog.
	 * @param itemName The name of the item being deleted.
	 */
	delete(itemName: string): Promise<boolean> {
		return this.confirm({
			title: `Delete ${itemName}?`,
			description: 'This action cannot be undone.',
			confirmText: 'Delete',
			cancelText: 'Cancel',
			variant: 'destructive',
			icon: 'danger',
		});
	}

	/**
	 * Show a discard changes confirmation dialog.
	 */
	discardChanges(): Promise<boolean> {
		return this.confirm({
			title: 'Discard changes?',
			description: 'You have unsaved changes that will be lost.',
			confirmText: 'Discard',
			cancelText: 'Keep editing',
			variant: 'destructive',
			icon: 'warning',
		});
	}

	/**
	 * Show a logout confirmation dialog.
	 */
	logout(): Promise<boolean> {
		return this.confirm({
			title: 'Sign out?',
			description: 'Are you sure you want to sign out?',
			confirmText: 'Sign out',
			cancelText: 'Cancel',
			variant: 'default',
			icon: 'question',
		});
	}
}

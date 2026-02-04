import { inject, Injectable } from '@angular/core';
import { ToastService, ConfirmationService } from '@momentum-cms/ui';

/**
 * Feedback Service
 *
 * CMS-specific toast messages and confirmations for entity operations.
 * Wraps the UI library's ToastService and ConfirmationService with
 * convenience methods for common CMS operations.
 *
 * @example
 * ```typescript
 * const feedback = inject(FeedbackService);
 *
 * // Success messages
 * feedback.entityCreated('Post');
 * feedback.entityUpdated('Post');
 * feedback.entityDeleted('Post');
 *
 * // Error messages
 * feedback.operationFailed('Failed to save', error);
 *
 * // Confirmations
 * const confirmed = await feedback.confirmDelete('Post', 'My Blog Post');
 * if (confirmed) {
 *   // Proceed with deletion
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
	private readonly toast = inject(ToastService);
	private readonly confirmation = inject(ConfirmationService);

	// === Success Messages ===

	/**
	 * Show success message when an entity is created.
	 */
	entityCreated(collectionLabel: string): void {
		this.toast.success(
			`${collectionLabel} created`,
			`The ${collectionLabel.toLowerCase()} has been created successfully.`,
		);
	}

	/**
	 * Show success message when an entity is updated.
	 */
	entityUpdated(collectionLabel: string): void {
		this.toast.success(
			`${collectionLabel} updated`,
			`The ${collectionLabel.toLowerCase()} has been updated successfully.`,
		);
	}

	/**
	 * Show success message when an entity is deleted.
	 */
	entityDeleted(collectionLabel: string): void {
		this.toast.success(
			`${collectionLabel} deleted`,
			`The ${collectionLabel.toLowerCase()} has been deleted.`,
		);
	}

	/**
	 * Show success message when multiple entities are deleted.
	 */
	entitiesDeleted(collectionLabel: string, count: number): void {
		this.toast.success(
			`${count} ${collectionLabel.toLowerCase()} deleted`,
			`${count} items have been deleted successfully.`,
		);
	}

	/**
	 * Show success message when an entity is published.
	 */
	entityPublished(collectionLabel: string): void {
		this.toast.success(
			`${collectionLabel} published`,
			`The ${collectionLabel.toLowerCase()} is now live.`,
		);
	}

	/**
	 * Show success message when an entity is unpublished.
	 */
	entityUnpublished(collectionLabel: string): void {
		this.toast.success(
			`${collectionLabel} unpublished`,
			`The ${collectionLabel.toLowerCase()} has been unpublished.`,
		);
	}

	// === Error Messages ===

	/**
	 * Show error message when an operation fails.
	 */
	operationFailed(message: string, error?: Error): void {
		const description = error?.message || 'Please try again or contact support.';
		this.toast.error(message, description);
	}

	/**
	 * Show error message when validation fails.
	 */
	validationFailed(fieldCount: number): void {
		const fields = fieldCount === 1 ? 'field' : 'fields';
		this.toast.error('Validation failed', `Please fix ${fieldCount} ${fields} with errors.`);
	}

	/**
	 * Show error message when not authorized.
	 */
	notAuthorized(action: string): void {
		this.toast.error('Not authorized', `You don't have permission to ${action}.`);
	}

	/**
	 * Show error message when entity not found.
	 */
	entityNotFound(collectionLabel: string): void {
		this.toast.error(
			`${collectionLabel} not found`,
			`The requested ${collectionLabel.toLowerCase()} could not be found.`,
		);
	}

	// === Warning Messages ===

	/**
	 * Show warning about unsaved changes.
	 */
	unsavedChanges(): void {
		this.toast.warning('Unsaved changes', 'You have unsaved changes that will be lost.');
	}

	// === Confirmations ===

	/**
	 * Confirm delete operation for a single entity.
	 * @param collectionLabel The collection label (e.g., "Post")
	 * @param entityTitle The entity title to display (optional)
	 * @returns Promise resolving to true if confirmed
	 */
	confirmDelete(collectionLabel: string, entityTitle?: string): Promise<boolean> {
		const title = entityTitle
			? `Delete "${entityTitle}"?`
			: `Delete this ${collectionLabel.toLowerCase()}?`;

		return this.confirmation.confirm({
			title,
			description: 'This action cannot be undone.',
			confirmText: 'Delete',
			cancelText: 'Cancel',
			variant: 'destructive',
			icon: 'danger',
		});
	}

	/**
	 * Confirm bulk delete operation.
	 * @param collectionLabel The collection label (e.g., "Posts")
	 * @param count Number of items to delete
	 * @returns Promise resolving to true if confirmed
	 */
	confirmBulkDelete(collectionLabel: string, count: number): Promise<boolean> {
		return this.confirmation.confirm({
			title: `Delete ${count} ${collectionLabel.toLowerCase()}?`,
			description: 'This action cannot be undone. All selected items will be permanently deleted.',
			confirmText: `Delete ${count} items`,
			cancelText: 'Cancel',
			variant: 'destructive',
			icon: 'danger',
		});
	}

	/**
	 * Confirm discard changes.
	 * @returns Promise resolving to true if confirmed
	 */
	confirmDiscard(): Promise<boolean> {
		return this.confirmation.discardChanges();
	}

	/**
	 * Confirm unpublish operation.
	 * @param collectionLabel The collection label
	 * @returns Promise resolving to true if confirmed
	 */
	confirmUnpublish(collectionLabel: string): Promise<boolean> {
		return this.confirmation.confirm({
			title: `Unpublish this ${collectionLabel.toLowerCase()}?`,
			description: 'This will remove the item from your public site.',
			confirmText: 'Unpublish',
			cancelText: 'Cancel',
			variant: 'default',
			icon: 'warning',
		});
	}

	/**
	 * Show confirmation with custom config.
	 */
	confirm(config: {
		title: string;
		description: string;
		confirmText?: string;
		cancelText?: string;
		variant?: 'default' | 'destructive';
	}): Promise<boolean> {
		return this.confirmation.confirm({
			...config,
			icon: config.variant === 'destructive' ? 'danger' : 'question',
		});
	}
}

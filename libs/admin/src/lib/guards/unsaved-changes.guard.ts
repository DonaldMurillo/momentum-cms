import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { FeedbackService } from '../widgets/feedback/feedback.service';

/**
 * Interface for components that track unsaved changes.
 */
export interface HasUnsavedChanges {
	hasUnsavedChanges(): boolean;
}

/**
 * Route guard that prompts the user before navigating away from a dirty form.
 *
 * Defensive: checks that the component implements HasUnsavedChanges before calling.
 * This is necessary because AdminPageResolver wraps the actual page component.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
	if (typeof component.hasUnsavedChanges !== 'function') return true;
	if (!component.hasUnsavedChanges()) return true;
	const feedback = inject(FeedbackService);
	return feedback.confirmDiscard();
};

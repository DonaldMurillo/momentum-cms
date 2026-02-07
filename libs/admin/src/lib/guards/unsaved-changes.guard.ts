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
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
	if (!component.hasUnsavedChanges()) return true;
	const feedback = inject(FeedbackService);
	return feedback.confirmDiscard();
};

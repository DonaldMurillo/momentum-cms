/**
 * Form event types for the standalone form builder.
 */

/**
 * Emitted when a form is submitted successfully.
 */
export interface FormSubmitEvent {
	/** Form values keyed by field name. */
	values: Record<string, unknown>;
	/** The form schema ID. */
	formId: string;
}

/**
 * Emitted when a multi-step form changes step.
 */
export interface FormStepChangeEvent {
	/** Index of the previous step. */
	previousIndex: number;
	/** Index of the current step. */
	currentIndex: number;
	/** ID of the current step. */
	currentStepId: string;
}

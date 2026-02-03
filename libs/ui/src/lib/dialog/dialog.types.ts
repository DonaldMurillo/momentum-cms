/**
 * Configuration options for opening a dialog.
 */
export interface DialogConfig<D = unknown> {
	/** Width of the dialog. Default: '28rem' */
	width?: string;
	/** Maximum width of the dialog. */
	maxWidth?: string;
	/** Minimum width of the dialog. */
	minWidth?: string;
	/** Whether clicking the backdrop closes the dialog. Default: true */
	disableClose?: boolean;
	/** Custom data to pass to the dialog component. */
	data?: D;
	/** Aria label for the dialog. */
	ariaLabel?: string;
	/** ID of the element that labels the dialog. */
	ariaLabelledBy?: string;
	/** ID of the element that describes the dialog. */
	ariaDescribedBy?: string;
	/** CSS class(es) to add to the overlay panel. */
	panelClass?: string | string[];
}

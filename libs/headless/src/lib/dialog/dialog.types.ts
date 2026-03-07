export interface HdlDialogConfig<D = unknown> {
	data?: D;
	width?: string;
	maxWidth?: string;
	minWidth?: string;
	height?: string;
	disableClose?: boolean;
	hasBackdrop?: boolean;
	backdropClass?: string;
	panelClass?: string | string[];
}

export interface HdlDrawerConfig<D = unknown> {
	data?: D;
	side?: 'left' | 'right' | 'top' | 'bottom';
	disableClose?: boolean;
	hasBackdrop?: boolean;
	panelClass?: string | string[];
	backdropClass?: string;
	width?: string;
	height?: string;
}

import { ComponentRef } from '@angular/core';
import { OverlayRef } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';

/**
 * Reference to an opened dialog.
 * Use this to close the dialog or subscribe to its lifecycle events.
 */
export class DialogRef<R = unknown> {
	private readonly _afterClosed = new Subject<R | undefined>();
	private readonly _backdropClick = new Subject<void>();

	/** Observable that emits when the dialog is closed. */
	readonly afterClosed = this._afterClosed.asObservable();

	/** Observable that emits when the backdrop is clicked. */
	readonly backdropClick = this._backdropClick.asObservable();

	/** The component instance inside the dialog. Set after creation. */
	componentRef: ComponentRef<unknown> | null = null;

	constructor(private readonly overlayRef: OverlayRef) {
		overlayRef.backdropClick().subscribe(() => {
			this._backdropClick.next();
		});
	}

	/**
	 * Close the dialog with an optional result.
	 */
	close(result?: R): void {
		this._afterClosed.next(result);
		this._afterClosed.complete();
		this.overlayRef.dispose();
	}

	/**
	 * Update the dialog's width.
	 */
	updateSize(width?: string, height?: string): void {
		this.overlayRef.updateSize({ width, height });
	}
}

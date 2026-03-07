import { ComponentRef } from '@angular/core';
import { OverlayRef } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';

export class HdlDialogRef<R = unknown> {
	private readonly _afterClosed = new Subject<R | undefined>();

	readonly afterClosed = this._afterClosed.asObservable();

	componentRef: ComponentRef<unknown> | null = null;

	constructor(private readonly overlayRef: OverlayRef) {}

	close(result?: R): void {
		this._afterClosed.next(result);
		this._afterClosed.complete();
		this.overlayRef.dispose();
	}

	updateSize(width?: string, height?: string): void {
		this.overlayRef.updateSize({ width, height });
	}
}

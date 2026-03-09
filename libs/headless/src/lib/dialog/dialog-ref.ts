import { ComponentRef } from '@angular/core';
import { OverlayRef } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';

export class HdlDialogRef<R = unknown> {
	private readonly _afterClosed = new Subject<R | undefined>();
	private closed = false;

	readonly afterClosed = this._afterClosed.asObservable();

	componentRef: ComponentRef<unknown> | null = null;

	constructor(private readonly overlayRef: OverlayRef) {
		this.overlayRef.detachments().subscribe(() => {
			this.finalize();
		});
	}

	close(result?: R): void {
		if (this.closed) return;
		this.finalize(result);
		this.overlayRef.dispose();
	}

	updateSize(width?: string, height?: string): void {
		this.overlayRef.updateSize({ width, height });
	}

	private finalize(result?: R): void {
		if (this.closed) return;
		this.closed = true;
		this._afterClosed.next(result);
		this._afterClosed.complete();
	}
}

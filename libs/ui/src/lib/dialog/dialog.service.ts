import { inject, Injectable, Injector, Type } from '@angular/core';
import { Overlay, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import type { DialogConfig } from './dialog.types';
import { DIALOG_DATA } from './dialog.token';
import { DialogRef } from './dialog-ref';

/**
 * Service for opening dialogs programmatically.
 *
 * Usage:
 * ```typescript
 * const dialogRef = this.dialog.open(MyDialogComponent, {
 *   data: { name: 'World' },
 *   width: '400px',
 * });
 *
 * dialogRef.afterClosed.subscribe(result => {
 *   console.log('Dialog closed with:', result);
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
	private readonly overlay = inject(Overlay);
	private readonly injector = inject(Injector);

	private openDialogs: Array<{ close: () => void }> = [];

	/**
	 * Open a dialog with the specified component.
	 */
	open<T, D = unknown, R = unknown>(component: Type<T>, config?: DialogConfig<D>): DialogRef<R> {
		const overlayConfig = this.getOverlayConfig(config);
		const overlayRef = this.overlay.create(overlayConfig);

		const dialogRef = new DialogRef<R>(overlayRef);

		const injector = Injector.create({
			parent: this.injector,
			providers: [
				{ provide: DialogRef, useValue: dialogRef },
				{ provide: DIALOG_DATA, useValue: config?.data },
			],
		});

		const portal = new ComponentPortal(component, null, injector);
		const componentRef = overlayRef.attach(portal);

		dialogRef.componentRef = componentRef;

		// Handle backdrop click
		if (!config?.disableClose) {
			overlayRef.backdropClick().subscribe(() => {
				dialogRef.close();
			});
		}

		// Handle escape key
		overlayRef.keydownEvents().subscribe((event) => {
			if (event.key === 'Escape' && !config?.disableClose) {
				dialogRef.close();
			}
		});

		this.openDialogs.push(dialogRef);

		dialogRef.afterClosed.subscribe(() => {
			const index = this.openDialogs.indexOf(dialogRef);
			if (index > -1) {
				this.openDialogs.splice(index, 1);
			}
		});

		return dialogRef;
	}

	/**
	 * Close all open dialogs.
	 */
	closeAll(): void {
		this.openDialogs.forEach((dialogRef) => dialogRef.close());
	}

	private getOverlayConfig(config?: DialogConfig): OverlayConfig {
		const positionStrategy = this.overlay
			.position()
			.global()
			.centerHorizontally()
			.centerVertically();

		const panelClasses = ['mcms-dialog-panel'];
		if (config?.panelClass) {
			if (Array.isArray(config.panelClass)) {
				panelClasses.push(...config.panelClass);
			} else {
				panelClasses.push(config.panelClass);
			}
		}

		return {
			positionStrategy,
			scrollStrategy: this.overlay.scrollStrategies.block(),
			hasBackdrop: true,
			backdropClass: 'mcms-dialog-backdrop',
			panelClass: panelClasses,
			width: config?.width ?? '28rem',
			maxWidth: config?.maxWidth ?? '90vw',
			minWidth: config?.minWidth,
		};
	}
}

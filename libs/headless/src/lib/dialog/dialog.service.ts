import { inject, Injectable, Injector, Type } from '@angular/core';
import { Overlay, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import type { HdlDialogConfig } from './dialog.types';
import { HDL_DIALOG_DATA } from './dialog.token';
import { HdlDialogRef } from './dialog-ref';

@Injectable({ providedIn: 'root' })
export class HdlDialogService {
	private readonly overlay = inject(Overlay);
	private readonly injector = inject(Injector);

	private openDialogs: Array<{ close: () => void }> = [];

	open<T, D = unknown, R = unknown>(
		component: Type<T>,
		config?: HdlDialogConfig<D>,
	): HdlDialogRef<R> {
		const overlayConfig = this.getOverlayConfig(config);
		const overlayRef = this.overlay.create(overlayConfig);

		const dialogRef = new HdlDialogRef<R>(overlayRef);

		const injector = Injector.create({
			parent: this.injector,
			providers: [
				{ provide: HdlDialogRef, useValue: dialogRef },
				{ provide: HDL_DIALOG_DATA, useValue: config?.data },
			],
		});

		const portal = new ComponentPortal(component, null, injector);
		const componentRef = overlayRef.attach(portal);

		dialogRef.componentRef = componentRef;

		if (!config?.disableClose) {
			overlayRef.backdropClick().subscribe(() => {
				dialogRef.close();
			});
		}

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

	closeAll(): void {
		for (const dialogRef of [...this.openDialogs]) {
			dialogRef.close();
		}
	}

	private getOverlayConfig(config?: HdlDialogConfig): OverlayConfig {
		const positionStrategy = this.overlay
			.position()
			.global()
			.centerHorizontally()
			.centerVertically();

		const panelClasses: string[] = [];
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
			hasBackdrop: config?.hasBackdrop ?? true,
			backdropClass: config?.backdropClass,
			panelClass: panelClasses.length > 0 ? panelClasses : undefined,
			width: config?.width,
			maxWidth: config?.maxWidth,
			minWidth: config?.minWidth,
			height: config?.height,
		};
	}
}

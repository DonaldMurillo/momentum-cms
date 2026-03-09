import { inject, Injectable, Injector, Type } from '@angular/core';
import { Overlay, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import type { HdlDrawerConfig } from './drawer.types';
import { HDL_DIALOG_DATA } from '../dialog/dialog.token';
import { HdlDialogRef } from '../dialog/dialog-ref';

@Injectable({ providedIn: 'root' })
export class HdlDrawerService {
	private readonly overlay = inject(Overlay);
	private readonly injector = inject(Injector);

	private openDrawers: Array<{ close: () => void }> = [];

	open<T, D = unknown, R = unknown>(
		component: Type<T>,
		config?: HdlDrawerConfig<D>,
	): HdlDialogRef<R> {
		const overlayRef = this.overlay.create(this.getOverlayConfig(config));
		const drawerRef = new HdlDialogRef<R>(overlayRef);

		const injector = Injector.create({
			parent: this.injector,
			providers: [
				{ provide: HdlDialogRef, useValue: drawerRef },
				{ provide: HDL_DIALOG_DATA, useValue: config?.data },
			],
		});

		const portal = new ComponentPortal(component, null, injector);
		const componentRef = overlayRef.attach(portal);
		drawerRef.componentRef = componentRef;

		if (!config?.disableClose) {
			overlayRef.backdropClick().subscribe(() => drawerRef.close());
		}

		overlayRef.keydownEvents().subscribe((event) => {
			if (event.key === 'Escape' && !config?.disableClose) {
				drawerRef.close();
			}
		});

		this.openDrawers.push(drawerRef);
		drawerRef.afterClosed.subscribe(() => {
			const index = this.openDrawers.indexOf(drawerRef);
			if (index > -1) {
				this.openDrawers.splice(index, 1);
			}
		});

		return drawerRef;
	}

	closeAll(): void {
		for (const drawerRef of [...this.openDrawers]) {
			drawerRef.close();
		}
	}

	private getOverlayConfig(config?: HdlDrawerConfig): OverlayConfig {
		const side = config?.side ?? 'right';
		const positionStrategy = this.overlay.position().global();

		if (side === 'left') {
			positionStrategy.left('0').top('0').bottom('0');
		} else if (side === 'right') {
			positionStrategy.right('0').top('0').bottom('0');
		} else if (side === 'top') {
			positionStrategy.top('0').left('0').right('0');
		} else {
			positionStrategy.bottom('0').left('0').right('0');
		}

		const panelClasses = ['hdl-drawer-panel', `hdl-drawer-panel--${side}`];
		if (config?.panelClass) {
			panelClasses.push(
				...(Array.isArray(config.panelClass) ? config.panelClass : [config.panelClass]),
			);
		}

		const backdropClasses = ['hdl-drawer-backdrop'];
		if (config?.backdropClass) {
			backdropClasses.push(config.backdropClass);
		}

		return {
			positionStrategy,
			scrollStrategy: this.overlay.scrollStrategies.block(),
			hasBackdrop: config?.hasBackdrop ?? true,
			backdropClass: backdropClasses,
			panelClass: panelClasses,
			width:
				side === 'left' || side === 'right'
					? (config?.width ?? 'min(90vw, 32rem)')
					: (config?.width ?? '100vw'),
			height:
				side === 'top' || side === 'bottom'
					? (config?.height ?? 'min(90vh, 24rem)')
					: (config?.height ?? '100vh'),
		};
	}
}

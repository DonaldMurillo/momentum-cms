import {
	Directive,
	ElementRef,
	inject,
	input,
	OnDestroy,
	signal,
	TemplateRef,
	ViewContainerRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

@Directive({
	selector: '[hdlContextMenuTrigger]',
	exportAs: 'hdlContextMenuTrigger',
	host: {
		'[attr.data-slot]': '"context-menu-trigger"',
		'[attr.data-state]': 'isOpen() ? "open" : "closed"',
		'(contextmenu)': 'openFromPointer($event)',
		'(keydown.shift.f10)': 'openFromKeyboard($event)',
		'(keydown.contextmenu)': 'openFromKeyboard($event)',
	},
})
export class HdlContextMenuTrigger implements OnDestroy {
	readonly hdlContextMenuTrigger = input.required<TemplateRef<unknown>>();

	private readonly doc = inject(DOCUMENT);
	private readonly overlay = inject(Overlay);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly viewContainerRef = inject(ViewContainerRef);

	readonly isOpen = signal(false);
	private overlayRef: OverlayRef | null = null;

	openFromPointer(event: MouseEvent): void {
		event.preventDefault();
		this.openAt(event.clientX, event.clientY);
	}

	openFromKeyboard(event: Event): void {
		event.preventDefault();
		const rect = this.elementRef.nativeElement.getBoundingClientRect();
		this.openAt(rect.left, rect.bottom);
	}

	close(): void {
		this.overlayRef?.dispose();
		this.overlayRef = null;
		this.isOpen.set(false);
	}

	ngOnDestroy(): void {
		this.close();
	}

	private openAt(x: number, y: number): void {
		this.close();

		this.overlayRef = this.overlay.create({
			positionStrategy: this.overlay
				.position()
				.flexibleConnectedTo({ x, y })
				.withPositions([
					{
						originX: 'start',
						originY: 'top',
						overlayX: 'start',
						overlayY: 'top',
					},
				]),
			scrollStrategy: this.overlay.scrollStrategies.reposition(),
			hasBackdrop: true,
			panelClass: 'hdl-context-menu-panel',
			backdropClass: ['cdk-overlay-transparent-backdrop', 'hdl-context-menu-backdrop'],
		});

		this.overlayRef.backdropClick().subscribe(() => this.close());
		this.overlayRef.keydownEvents().subscribe((overlayEvent) => {
			if (overlayEvent.key === 'Escape') {
				this.close();
				this.elementRef.nativeElement.focus();
			}
		});

		const portal = new TemplatePortal(this.hdlContextMenuTrigger(), this.viewContainerRef);
		this.overlayRef.attach(portal);
		this.isOpen.set(true);

		this.doc.defaultView?.requestAnimationFrame(() => {
			const focusable = this.overlayRef?.overlayElement.querySelector<HTMLElement>(
				'[role="menuitem"], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
			);
			focusable?.focus();
		});
	}
}

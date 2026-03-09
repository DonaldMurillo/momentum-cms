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
import { getPopoverPositions } from '../popover/popover.utils';

@Directive({
	selector: '[hdlHoverCardTrigger]',
	exportAs: 'hdlHoverCardTrigger',
	host: {
		'[attr.data-slot]': '"hover-card-trigger"',
		'[attr.data-state]': 'isOpen() ? "open" : "closed"',
		'(mouseenter)': 'scheduleOpen(false)',
		'(mouseleave)': 'scheduleClose()',
		'(focusin)': 'scheduleOpen(true)',
		'(focusout)': 'scheduleClose()',
	},
})
export class HdlHoverCardTrigger implements OnDestroy {
	readonly hdlHoverCardTrigger = input.required<TemplateRef<unknown>>();
	readonly openDelay = input(150);
	readonly closeDelay = input(150);

	private readonly doc = inject(DOCUMENT);
	private readonly overlay = inject(Overlay);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly viewContainerRef = inject(ViewContainerRef);

	readonly isOpen = signal(false);
	private overlayRef: OverlayRef | null = null;
	private openTimeout: number | null = null;
	private closeTimeout: number | null = null;
	private openedViaKeyboard = false;

	scheduleOpen(keyboard: boolean): void {
		this.clearCloseTimeout();
		if (this.isOpen()) return;
		this.clearOpenTimeout();
		this.openedViaKeyboard = keyboard;
		this.openTimeout =
			this.doc.defaultView?.setTimeout(() => this.open(), this.openDelay()) ?? null;
	}

	scheduleClose(): void {
		this.clearOpenTimeout();
		this.clearCloseTimeout();
		this.closeTimeout =
			this.doc.defaultView?.setTimeout(() => this.close(), this.closeDelay()) ?? null;
	}

	ngOnDestroy(): void {
		this.clearOpenTimeout();
		this.clearCloseTimeout();
		this.close();
	}

	private open(): void {
		if (this.isOpen()) return;

		this.overlayRef = this.overlay.create({
			positionStrategy: this.overlay
				.position()
				.flexibleConnectedTo(this.elementRef)
				.withPositions(getPopoverPositions('bottom', 'center', 8))
				.withPush(true),
			scrollStrategy: this.overlay.scrollStrategies.reposition(),
			panelClass: 'hdl-hover-card-panel',
		});

		const portal = new TemplatePortal(this.hdlHoverCardTrigger(), this.viewContainerRef);
		this.overlayRef.attach(portal);
		this.isOpen.set(true);

		this.overlayRef.overlayElement.addEventListener('mouseenter', this.handleOverlayEnter);
		this.overlayRef.overlayElement.addEventListener('mouseleave', this.handleOverlayLeave);

		if (this.openedViaKeyboard) {
			this.doc.defaultView?.requestAnimationFrame(() => {
				this.overlayRef?.overlayElement
					.querySelector<HTMLElement>('[tabindex], a[href], button:not([disabled])')
					?.focus();
			});
		}
	}

	private close(): void {
		if (this.overlayRef) {
			this.overlayRef.overlayElement.removeEventListener('mouseenter', this.handleOverlayEnter);
			this.overlayRef.overlayElement.removeEventListener('mouseleave', this.handleOverlayLeave);
			this.overlayRef.dispose();
			this.overlayRef = null;
		}
		this.isOpen.set(false);
	}

	private readonly handleOverlayEnter = (): void => {
		this.clearCloseTimeout();
	};

	private readonly handleOverlayLeave = (): void => {
		this.scheduleClose();
	};

	private clearOpenTimeout(): void {
		if (this.openTimeout !== null) {
			this.doc.defaultView?.clearTimeout(this.openTimeout);
			this.openTimeout = null;
		}
	}

	private clearCloseTimeout(): void {
		if (this.closeTimeout !== null) {
			this.doc.defaultView?.clearTimeout(this.closeTimeout);
			this.closeTimeout = null;
		}
	}
}

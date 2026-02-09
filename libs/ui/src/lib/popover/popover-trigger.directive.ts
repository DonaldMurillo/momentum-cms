import {
	Directive,
	effect,
	ElementRef,
	inject,
	input,
	OnDestroy,
	output,
	signal,
	TemplateRef,
	ViewContainerRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Overlay, OverlayRef, PositionStrategy } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import type { PopoverAlign, PopoverSide } from './popover.types';
import { getPopoverPositions } from './popover.utils';

/**
 * Popover trigger directive.
 *
 * Usage:
 * ```html
 * <button [mcmsPopoverTrigger]="popoverContent">Open Popover</button>
 *
 * <ng-template #popoverContent>
 *   <mcms-popover-content>
 *     <p>Popover content here</p>
 *   </mcms-popover-content>
 * </ng-template>
 * ```
 */
@Directive({
	selector: '[mcmsPopoverTrigger]',
	exportAs: 'mcmsPopoverTrigger',
	host: {
		'(click)': 'toggle()',
		'[attr.aria-expanded]': 'isOpen()',
		'[attr.aria-haspopup]': '"dialog"',
	},
})
export class PopoverTrigger implements OnDestroy {
	readonly mcmsPopoverTrigger = input.required<TemplateRef<unknown>>();
	readonly popoverSide = input<PopoverSide>('bottom');
	readonly popoverAlign = input<PopoverAlign>('center');
	readonly popoverOffset = input(4);
	readonly popoverDisabled = input(false);

	readonly isOpen = signal(false);
	readonly opened = output<void>();
	readonly closed = output<void>();

	private readonly doc = inject(DOCUMENT);
	private readonly overlay = inject(Overlay);
	private readonly elementRef = inject(ElementRef<HTMLElement>);
	private readonly viewContainerRef = inject(ViewContainerRef);

	private overlayRef: OverlayRef | null = null;

	private readonly disabledEffect = effect(() => {
		if (this.popoverDisabled() && this.isOpen()) {
			this.close();
		}
	});

	toggle(): void {
		if (this.isOpen()) {
			this.close();
		} else {
			this.open();
		}
	}

	open(): void {
		if (this.popoverDisabled() || this.isOpen()) return;

		this.createOverlay();
		this.isOpen.set(true);
		this.opened.emit();
	}

	close(): void {
		if (this.overlayRef) {
			this.overlayRef.dispose();
			this.overlayRef = null;
		}
		this.isOpen.set(false);
		this.closed.emit();
	}

	ngOnDestroy(): void {
		this.close();
	}

	private createOverlay(): void {
		const positionStrategy = this.getPositionStrategy();
		const scrollStrategy = this.overlay.scrollStrategies.reposition();

		this.overlayRef = this.overlay.create({
			positionStrategy,
			scrollStrategy,
			hasBackdrop: true,
			backdropClass: 'cdk-overlay-transparent-backdrop',
			panelClass: 'mcms-popover-panel',
		});

		this.overlayRef.backdropClick().subscribe(() => {
			this.close();
		});

		this.overlayRef.keydownEvents().subscribe((event) => {
			if (event.key === 'Escape') {
				this.close();
				this.elementRef.nativeElement.focus();
			}
		});

		const portal = new TemplatePortal(this.mcmsPopoverTrigger(), this.viewContainerRef);
		this.overlayRef.attach(portal);

		// Focus the first focusable element inside the popover for keyboard accessibility
		this.doc.defaultView?.requestAnimationFrame(() => {
			const overlayEl = this.overlayRef?.overlayElement;
			if (overlayEl) {
				const focusable = overlayEl.querySelector<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
				);
				focusable?.focus();
			}
		});
	}

	private getPositionStrategy(): PositionStrategy {
		const positions = getPopoverPositions(
			this.popoverSide(),
			this.popoverAlign(),
			this.popoverOffset(),
		);

		return this.overlay
			.position()
			.flexibleConnectedTo(this.elementRef)
			.withPositions(positions)
			.withPush(true);
	}
}

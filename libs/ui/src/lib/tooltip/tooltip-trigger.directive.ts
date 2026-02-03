import {
	computed,
	Directive,
	effect,
	ElementRef,
	inject,
	input,
	OnDestroy,
	signal,
	ViewContainerRef,
} from '@angular/core';
import { Overlay, OverlayRef, PositionStrategy } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import type { TooltipPosition } from './tooltip.types';
import { TOOLTIP_POSITION_MAP } from './tooltip.types';
import { TooltipContent } from './tooltip-content.component';

/**
 * Tooltip trigger directive.
 *
 * Apply this directive to any element to show a tooltip on hover/focus.
 *
 * Usage:
 * ```html
 * <button [mcmsTooltip]="'Click to save'">Save</button>
 * <button [mcmsTooltip]="'Delete item'" tooltipPosition="right">Delete</button>
 * ```
 */
@Directive({
	selector: '[mcmsTooltip]',
	host: {
		'(mouseenter)': 'onMouseEnter()',
		'(mouseleave)': 'onMouseLeave()',
		'(focus)': 'onFocus()',
		'(blur)': 'onBlur()',
		'[attr.aria-describedby]': 'tooltipId()',
	},
})
export class TooltipTrigger implements OnDestroy {
	readonly mcmsTooltip = input.required<string>();
	readonly tooltipPosition = input<TooltipPosition>('top');
	readonly tooltipDelay = input(300);
	readonly tooltipDisabled = input(false);

	private readonly overlay = inject(Overlay);
	private readonly elementRef = inject(ElementRef<HTMLElement>);
	private readonly viewContainerRef = inject(ViewContainerRef);

	private overlayRef: OverlayRef | null = null;
	private showTimeout: ReturnType<typeof setTimeout> | null = null;
	private hideTimeout: ReturnType<typeof setTimeout> | null = null;

	readonly isVisible = signal(false);
	readonly tooltipId = computed(() => (this.isVisible() ? `tooltip-${this.uniqueId}` : null));

	private readonly uniqueId = Math.random().toString(36).substring(2, 9);

	private readonly disabledEffect = effect(() => {
		if (this.tooltipDisabled() && this.isVisible()) {
			this.hide();
		}
	});

	onMouseEnter(): void {
		this.scheduleShow();
	}

	onMouseLeave(): void {
		this.cancelShow();
		this.scheduleHide();
	}

	onFocus(): void {
		this.show();
	}

	onBlur(): void {
		this.hide();
	}

	ngOnDestroy(): void {
		this.cancelShow();
		this.cancelHide();
		this.hide();
	}

	private scheduleShow(): void {
		if (this.tooltipDisabled()) return;

		this.cancelHide();
		this.showTimeout = setTimeout(() => {
			this.show();
		}, this.tooltipDelay());
	}

	private scheduleHide(): void {
		this.hideTimeout = setTimeout(() => {
			this.hide();
		}, 100);
	}

	private cancelShow(): void {
		if (this.showTimeout) {
			clearTimeout(this.showTimeout);
			this.showTimeout = null;
		}
	}

	private cancelHide(): void {
		if (this.hideTimeout) {
			clearTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}

	private show(): void {
		if (this.tooltipDisabled() || this.isVisible()) return;

		this.createOverlay();
		this.isVisible.set(true);
	}

	private hide(): void {
		if (this.overlayRef) {
			this.overlayRef.dispose();
			this.overlayRef = null;
		}
		this.isVisible.set(false);
	}

	private createOverlay(): void {
		const positionStrategy = this.getPositionStrategy();
		const scrollStrategy = this.overlay.scrollStrategies.close();

		this.overlayRef = this.overlay.create({
			positionStrategy,
			scrollStrategy,
			panelClass: 'mcms-tooltip-panel',
		});

		const portal = new ComponentPortal(TooltipContent, this.viewContainerRef);
		const componentRef = this.overlayRef.attach(portal);

		componentRef.setInput('content', this.mcmsTooltip());
		componentRef.setInput('id', `tooltip-${this.uniqueId}`);
	}

	private getPositionStrategy(): PositionStrategy {
		const positions = TOOLTIP_POSITION_MAP[this.tooltipPosition()];

		return this.overlay
			.position()
			.flexibleConnectedTo(this.elementRef)
			.withPositions(positions)
			.withPush(true);
	}
}

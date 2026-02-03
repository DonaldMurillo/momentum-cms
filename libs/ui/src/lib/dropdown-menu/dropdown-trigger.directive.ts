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
import { Overlay, OverlayRef, PositionStrategy } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import type { DropdownMenuAlign, DropdownMenuSide } from './dropdown-menu.types';
import { getDropdownPositions } from './dropdown-menu.utils';

/**
 * Dropdown menu trigger directive.
 *
 * Usage:
 * ```html
 * <button [mcmsDropdownTrigger]="menuContent">Open Menu</button>
 *
 * <ng-template #menuContent>
 *   <mcms-dropdown-menu>
 *     <button mcms-dropdown-item>Item 1</button>
 *     <button mcms-dropdown-item>Item 2</button>
 *   </mcms-dropdown-menu>
 * </ng-template>
 * ```
 */
@Directive({
	selector: '[mcmsDropdownTrigger]',
	exportAs: 'mcmsDropdownTrigger',
	host: {
		'(click)': 'toggle()',
		'(keydown.enter)': 'open()',
		'(keydown.space)': 'open(); $event.preventDefault()',
		'(keydown.arrowdown)': 'open(); $event.preventDefault()',
		'[attr.aria-expanded]': 'isOpen()',
		'[attr.aria-haspopup]': '"menu"',
	},
})
export class DropdownTrigger implements OnDestroy {
	readonly mcmsDropdownTrigger = input.required<TemplateRef<unknown>>();
	readonly dropdownSide = input<DropdownMenuSide>('bottom');
	readonly dropdownAlign = input<DropdownMenuAlign>('start');
	readonly dropdownOffset = input(4);
	readonly dropdownDisabled = input(false);

	readonly isOpen = signal(false);
	readonly opened = output<void>();
	readonly closed = output<void>();

	private readonly overlay = inject(Overlay);
	private readonly elementRef = inject(ElementRef<HTMLElement>);
	private readonly viewContainerRef = inject(ViewContainerRef);

	private overlayRef: OverlayRef | null = null;

	private readonly disabledEffect = effect(() => {
		if (this.dropdownDisabled() && this.isOpen()) {
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
		if (this.dropdownDisabled() || this.isOpen()) return;

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
			panelClass: 'mcms-dropdown-panel',
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

		const portal = new TemplatePortal(this.mcmsDropdownTrigger(), this.viewContainerRef, {
			close: () => this.close(),
		});
		this.overlayRef.attach(portal);
	}

	private getPositionStrategy(): PositionStrategy {
		const positions = getDropdownPositions(
			this.dropdownSide(),
			this.dropdownAlign(),
			this.dropdownOffset(),
		);

		return this.overlay
			.position()
			.flexibleConnectedTo(this.elementRef)
			.withPositions(positions)
			.withPush(true);
	}
}

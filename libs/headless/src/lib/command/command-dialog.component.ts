import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	NgZone,
	TemplateRef,
	ViewContainerRef,
	afterNextRender,
	effect,
	inject,
	input,
	model,
	output,
	viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
	selector: 'hdl-command-dialog',
	imports: [A11yModule],
	host: {
		'[attr.data-slot]': '"command-dialog"',
	},
	template: `
		<ng-template #dialogTpl>
			<div
				role="dialog"
				aria-modal="true"
				[attr.aria-label]="label()"
				[attr.data-slot]="'command-dialog-panel'"
				[attr.data-state]="open() ? 'open' : 'closed'"
				cdkTrapFocus
				cdkTrapFocusAutoCapture
			>
				<ng-content />
			</div>
		</ng-template>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlCommandDialog {
	private readonly overlay = inject(Overlay);
	private readonly document = inject(DOCUMENT);
	private readonly destroyRef = inject(DestroyRef);
	private readonly ngZone = inject(NgZone);
	private readonly vcr = inject(ViewContainerRef);

	readonly dialogTpl = viewChild.required<TemplateRef<unknown>>('dialogTpl');

	/** Two-way binding for open state. */
	readonly open = model(false);

	/** Keyboard shortcut key (used with Meta/Ctrl). Set to empty string to disable. */
	readonly shortcut = input('k');

	/** Accessible label for the dialog. */
	readonly label = input('Command palette');

	/** Emitted when the dialog is closed. */
	readonly closed = output<void>();

	private overlayRef: OverlayRef | null = null;
	private portal: TemplatePortal | null = null;

	constructor() {
		afterNextRender(() => {
			this.setupKeyboardShortcut();
		});

		effect(() => {
			if (this.open()) {
				this.openOverlay();
			} else {
				this.closeOverlay();
			}
		});

		this.destroyRef.onDestroy(() => {
			this.disposeOverlay();
			this.removeKeyboardShortcut();
		});
	}

	private keydownHandler = (event: KeyboardEvent): void => {
		const key = this.shortcut();
		if (!key) return;

		if ((event.metaKey || event.ctrlKey) && event.key === key) {
			event.preventDefault();
			this.ngZone.run(() => {
				this.open.update((v) => !v);
			});
		}
	};

	private setupKeyboardShortcut(): void {
		this.document.addEventListener('keydown', this.keydownHandler);
	}

	private removeKeyboardShortcut(): void {
		this.document.removeEventListener('keydown', this.keydownHandler);
	}

	private openOverlay(): void {
		if (this.overlayRef?.hasAttached()) return;

		const positionStrategy = this.overlay.position().global().centerHorizontally().top('15vh');

		this.overlayRef = this.overlay.create({
			positionStrategy,
			scrollStrategy: this.overlay.scrollStrategies.block(),
			hasBackdrop: true,
			backdropClass: 'hdl-command-dialog-backdrop',
			panelClass: 'hdl-command-dialog-panel',
			width: 'min(40rem, calc(100vw - 2rem))',
		});

		this.portal = new TemplatePortal(this.dialogTpl(), this.vcr);
		this.overlayRef.attach(this.portal);

		this.overlayRef.backdropClick().subscribe(() => {
			this.open.set(false);
		});

		this.overlayRef.keydownEvents().subscribe((event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				this.open.set(false);
			}
		});
	}

	private closeOverlay(): void {
		if (this.overlayRef?.hasAttached()) {
			this.overlayRef.detach();
			this.closed.emit();
		}
	}

	private disposeOverlay(): void {
		this.overlayRef?.dispose();
		this.overlayRef = null;
		this.portal = null;
	}
}

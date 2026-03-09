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
import { HdlCommandDialogPanel } from './command-dialog-panel.component';

@Component({
	selector: 'hdl-command-dialog',
	imports: [HdlCommandDialogPanel],
	host: {
		'[attr.data-slot]': '"command-dialog"',
	},
	template: `
		<ng-template #dialogTpl>
			<hdl-command-dialog-panel [label]="label()" [state]="open() ? 'open' : 'closed'">
				<ng-content />
			</hdl-command-dialog-panel>
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

	/** Overlay width. Consumers can override the default. */
	readonly overlayWidth = input('min(40rem, calc(100vw - 2rem))');

	/** Overlay vertical offset from top. */
	readonly overlayTop = input('15vh');

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

		const positionStrategy = this.overlay
			.position()
			.global()
			.centerHorizontally()
			.top(this.overlayTop());

		this.overlayRef = this.overlay.create({
			positionStrategy,
			scrollStrategy: this.overlay.scrollStrategies.block(),
			hasBackdrop: true,
			backdropClass: 'hdl-command-dialog-backdrop',
			panelClass: 'hdl-command-dialog-panel',
			width: this.overlayWidth(),
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
		if (this.overlayRef) {
			this.overlayRef.dispose();
			this.overlayRef = null;
			this.portal = null;
			this.closed.emit();
		}
	}

	private disposeOverlay(): void {
		this.closeOverlay();
	}
}

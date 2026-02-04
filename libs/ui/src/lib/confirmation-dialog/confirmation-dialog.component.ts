import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Dialog } from '../dialog/dialog.component';
import { DialogClose } from '../dialog/dialog-close.directive';
import { DialogDescription } from '../dialog/dialog-description.component';
import { DialogFooter } from '../dialog/dialog-footer.component';
import { DialogHeader } from '../dialog/dialog-header.component';
import { DialogRef } from '../dialog/dialog-ref';
import { DialogTitle } from '../dialog/dialog-title.component';
import { DIALOG_DATA } from '../dialog/dialog.token';
import { Button } from '../button/button.component';
import type { ConfirmationConfig } from './confirmation-dialog.types';

/**
 * Internal confirmation dialog component.
 */
@Component({
	selector: 'mcms-confirmation-dialog',
	imports: [
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter,
		DialogClose,
		Button,
	],
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				@if (config.icon) {
					<div [class]="iconContainerClass()">
						@switch (config.icon) {
							@case ('warning') {
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
									/>
									<path d="M12 9v4" />
									<path d="M12 17h.01" />
								</svg>
							}
							@case ('danger') {
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<circle cx="12" cy="12" r="10" />
									<path d="m15 9-6 6" />
									<path d="m9 9 6 6" />
								</svg>
							}
							@case ('info') {
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<circle cx="12" cy="12" r="10" />
									<path d="M12 16v-4" />
									<path d="M12 8h.01" />
								</svg>
							}
							@case ('question') {
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<circle cx="12" cy="12" r="10" />
									<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
									<path d="M12 17h.01" />
								</svg>
							}
						}
					</div>
				}
				<mcms-dialog-title>{{ config.title }}</mcms-dialog-title>
				@if (config.description) {
					<mcms-dialog-description>{{ config.description }}</mcms-dialog-description>
				}
			</mcms-dialog-header>
			<mcms-dialog-footer>
				<button mcms-button variant="outline" [mcmsDialogClose]="false">
					{{ config.cancelText ?? 'Cancel' }}
				</button>
				<button mcms-button [variant]="confirmVariant()" [mcmsDialogClose]="true">
					{{ config.confirmText ?? 'Confirm' }}
				</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
	styles: `
		:host {
			display: contents;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogComponent {
	readonly config = inject<ConfirmationConfig>(DIALOG_DATA);
	private readonly dialogRef = inject(DialogRef<boolean>);

	readonly confirmVariant = computed(() =>
		this.config.variant === 'destructive' ? 'destructive' : 'primary',
	);

	readonly iconContainerClass = computed(() => {
		const baseClass = 'flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto';

		switch (this.config.icon) {
			case 'warning':
				return `${baseClass} bg-warning/10 text-warning`;
			case 'danger':
				return `${baseClass} bg-destructive/10 text-destructive`;
			case 'info':
				return `${baseClass} bg-info/10 text-info`;
			case 'question':
				return `${baseClass} bg-primary/10 text-primary`;
			default:
				return baseClass;
		}
	});
}

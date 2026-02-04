import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	OnInit,
	signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';

/**
 * Dialog container component.
 *
 * Usage:
 * ```html
 * <mcms-dialog>
 *   <mcms-dialog-header>
 *     <mcms-dialog-title>Dialog Title</mcms-dialog-title>
 *     <mcms-dialog-description>Optional description</mcms-dialog-description>
 *   </mcms-dialog-header>
 *   <mcms-dialog-content>
 *     Content goes here
 *   </mcms-dialog-content>
 *   <mcms-dialog-footer>
 *     <button mcms-button variant="outline" mcmsDialogClose>Cancel</button>
 *     <button mcms-button [mcmsDialogClose]="true">Confirm</button>
 *   </mcms-dialog-footer>
 * </mcms-dialog>
 * ```
 */
@Component({
	selector: 'mcms-dialog',
	imports: [A11yModule],
	host: {
		role: 'dialog',
		'[attr.aria-modal]': 'true',
		'[attr.aria-labelledby]': 'titleId()',
		'[attr.aria-describedby]': 'descriptionId()',
		'[class]': 'hostClass()',
	},
	template: `
		<div class="dialog-content" cdkTrapFocus cdkTrapFocusAutoCapture>
			<ng-content />
		</div>
	`,
	styles: `
		:host {
			display: block;
			position: relative;
			border-radius: 0.5rem;
			border: 1px solid hsl(var(--mcms-border));
			background-color: hsl(var(--mcms-card));
			color: hsl(var(--mcms-card-foreground));
			box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
			animation: dialog-content-in 0.2s ease-out;
			max-height: 85vh;
			overflow: hidden;
			display: flex;
			flex-direction: column;
		}

		.dialog-content {
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}

		@keyframes dialog-content-in {
			from {
				opacity: 0;
				transform: scale(0.96);
			}
			to {
				opacity: 1;
				transform: scale(1);
			}
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialog implements OnInit {
	readonly class = input('');

	readonly titleId = signal<string | null>(null);
	readonly descriptionId = signal<string | null>(null);

	readonly hostClass = computed(() => this.class());

	private readonly document = inject(DOCUMENT);

	ngOnInit(): void {
		// Add backdrop styles to document if not present
		this.addBackdropStyles();
	}

	registerTitle(id: string): void {
		this.titleId.set(id);
	}

	registerDescription(id: string): void {
		this.descriptionId.set(id);
	}

	private addBackdropStyles(): void {
		const styleId = 'mcms-dialog-backdrop-styles';
		if (!this.document.getElementById(styleId)) {
			const style = this.document.createElement('style');
			style.id = styleId;
			style.textContent = `
				.mcms-dialog-backdrop {
					background-color: hsl(var(--mcms-overlay) / 0.8);
					animation: dialog-overlay-in 0.15s ease-out;
				}
				@keyframes dialog-overlay-in {
					from { opacity: 0; }
					to { opacity: 1; }
				}
			`;
			this.document.head.appendChild(style);
		}
	}
}

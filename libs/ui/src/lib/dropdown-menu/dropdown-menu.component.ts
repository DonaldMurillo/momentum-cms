import {
	AfterContentInit,
	ChangeDetectionStrategy,
	Component,
	contentChildren,
	OnDestroy,
} from '@angular/core';
import { FocusKeyManager } from '@angular/cdk/a11y';
import { DropdownMenuItem } from './dropdown-menu-item.component';

/**
 * Dropdown menu container component.
 *
 * Usage:
 * ```html
 * <mcms-dropdown-menu>
 *   <mcms-dropdown-label>Actions</mcms-dropdown-label>
 *   <button mcms-dropdown-item>Edit</button>
 *   <button mcms-dropdown-item>Duplicate</button>
 *   <mcms-dropdown-separator />
 *   <button mcms-dropdown-item>Delete</button>
 * </mcms-dropdown-menu>
 * ```
 */
@Component({
	selector: 'mcms-dropdown-menu',
	host: {
		role: 'menu',
		'[attr.aria-orientation]': '"vertical"',
		'(keydown)': 'onKeydown($event)',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: flex;
			flex-direction: column;
			z-index: 50;
			min-width: 8rem;
			overflow: hidden;
			border-radius: 0.375rem;
			border: 1px solid hsl(var(--mcms-border));
			background-color: hsl(var(--mcms-card));
			color: hsl(var(--mcms-card-foreground));
			padding: 0.25rem;
			box-shadow:
				0 10px 15px -3px rgb(0 0 0 / 0.1),
				0 4px 6px -4px rgb(0 0 0 / 0.1);
			animation: dropdown-in 0.15s ease-out;
		}

		@keyframes dropdown-in {
			from {
				opacity: 0;
				transform: scale(0.95);
			}
			to {
				opacity: 1;
				transform: scale(1);
			}
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownMenu implements AfterContentInit, OnDestroy {
	readonly items = contentChildren(DropdownMenuItem);

	private keyManager!: FocusKeyManager<DropdownMenuItem>;

	ngAfterContentInit(): void {
		this.keyManager = new FocusKeyManager(this.items())
			.withWrap()
			.withVerticalOrientation()
			.skipPredicate((item) => item.disabled);

		// Focus first item when menu opens
		setTimeout(() => {
			this.keyManager.setFirstItemActive();
		});
	}

	ngOnDestroy(): void {
		this.keyManager?.destroy();
	}

	onKeydown(event: KeyboardEvent): void {
		this.keyManager.onKeydown(event);
	}
}

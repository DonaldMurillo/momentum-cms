import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { Badge } from '../badge/badge.component';
import { SidebarService } from './sidebar.service';

/**
 * A navigation item within the sidebar.
 *
 * @example
 * ```html
 * <mcms-sidebar-nav-item
 *   label="Dashboard"
 *   href="/dashboard"
 *   icon="heroSquares2x2"
 *   [active]="true"
 * />
 *
 * <mcms-sidebar-nav-item
 *   label="Notifications"
 *   href="/notifications"
 *   icon="heroBell"
 *   [badge]="5"
 * />
 * ```
 */
@Component({
	selector: 'mcms-sidebar-nav-item',
	imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, Badge, NgIcon],
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		@if (href()) {
			<a
				[routerLink]="href()"
				routerLinkActive="active bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
				ariaCurrentWhenActive="page"
				[routerLinkActiveOptions]="{ exact: exact() }"
				[class]="linkClasses()"
				[attr.aria-disabled]="disabled() || null"
				[attr.tabindex]="disabled() ? -1 : 0"
				(click)="handleNavigation()"
			>
				<ng-container *ngTemplateOutlet="content" />
			</a>
		} @else {
			<button type="button" [class]="linkClasses()" [disabled]="disabled()" (click)="handleClick()">
				<ng-container *ngTemplateOutlet="content" />
			</button>
		}

		<ng-template #content>
			@if (icon()) {
				<ng-icon
					[name]="icon()!"
					class="shrink-0 text-sidebar-foreground/55 group-[.active]:text-sidebar-foreground"
					size="16"
					aria-hidden="true"
				/>
			}
			<span class="flex-1 truncate">{{ label() }}</span>
			@if (badge() !== undefined) {
				<mcms-badge variant="secondary" class="ml-auto">{{ badge() }}</mcms-badge>
			}
		</ng-template>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarNavItem {
	private readonly sidebar = inject(SidebarService, { optional: true });

	/** Display label for the nav item. */
	readonly label = input.required<string>();

	/** Navigation URL. If not provided, renders as a button. */
	readonly href = input<string>();

	/** Icon name from ng-icons (e.g., 'heroSquares2x2', 'heroUsers'). */
	readonly icon = input<string>();

	/** Badge content to display. */
	readonly badge = input<string | number>();

	/** Whether this item is currently active. */
	readonly active = input(false);

	/** Whether this item is disabled. */
	readonly disabled = input(false);

	/** Whether to match the route exactly. */
	readonly exact = input(false);

	/** Additional CSS classes. */
	readonly class = input('');

	/** Emitted when the item is clicked (for non-link items). */
	readonly clicked = output<void>();

	readonly hostClasses = computed(() => {
		return `block ${this.class()}`.trim();
	});

	readonly linkClasses = computed(() => {
		/* Tighter rhythm than before: 28px row height, 13px label, 16px icon. The active
		 * state is conveyed by background tint + semibold weight + foreground color shift —
		 * no side-stripe (impeccable BAN 1) and no animated indicator. */
		const base =
			'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--mcms-radius)] text-sm font-medium text-sidebar-foreground/80 transition-colors w-full';
		const interactive = this.disabled()
			? 'opacity-50 cursor-not-allowed'
			: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground';
		const activeClass = this.active()
			? 'active bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
			: '';
		return `${base} ${interactive} ${activeClass}`.trim();
	});

	handleClick(): void {
		if (!this.disabled()) {
			this.clicked.emit();
		}
	}

	/** Close mobile drawer when navigating */
	handleNavigation(): void {
		if (this.sidebar?.isMobile()) {
			this.sidebar.setOpen(false);
		}
	}
}

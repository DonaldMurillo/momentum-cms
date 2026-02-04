import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';

/**
 * A collapsible section within the sidebar navigation.
 *
 * @example
 * ```html
 * <mcms-sidebar-section title="Settings" [collapsible]="true">
 *   <mcms-sidebar-nav-item label="Profile" href="/settings/profile" />
 *   <mcms-sidebar-nav-item label="Security" href="/settings/security" />
 * </mcms-sidebar-section>
 * ```
 */
@Component({
	selector: 'mcms-sidebar-section',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `
		@if (title()) {
			@if (collapsible()) {
				<button
					type="button"
					class="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
					[attr.aria-expanded]="expanded()"
					[attr.aria-label]="'Toggle ' + title() + ' section'"
					(click)="toggle()"
				>
					<span>{{ title() }}</span>
					<svg
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="transition-transform duration-200"
						[class.rotate-180]="expanded()"
					>
						<path d="m6 9 6 6 6-6" />
					</svg>
				</button>
			} @else {
				<div
					class="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60"
				>
					{{ title() }}
				</div>
			}
		}
		@if (!collapsible() || expanded()) {
			<div class="flex flex-col gap-1" [class.mt-1]="title()">
				<ng-content />
			</div>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarSection {
	/** Section title. */
	readonly title = input<string>();

	/** Whether the section can be collapsed. */
	readonly collapsible = input(false);

	/** Whether the section is expanded (two-way binding). */
	readonly expanded = model(true);

	/** Emitted when the expanded state changes. */
	readonly expandedChange = output<boolean>();

	/** Additional CSS classes. */
	readonly class = input('');

	readonly hostClasses = computed(() => {
		const base = 'block';
		return `${base} ${this.class()}`.trim();
	});

	toggle(): void {
		const newValue = !this.expanded();
		this.expanded.set(newValue);
		this.expandedChange.emit(newValue);
	}
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EmptyStateSize } from './empty-state.types';

/**
 * Empty state component for displaying placeholder content when there is no data.
 *
 * @example
 * ```html
 * <mcms-empty-state title="No results found" description="Try adjusting your search criteria">
 *   <svg mcms-empty-state-icon>...</svg>
 *   <button mcms-empty-state-action mcms-button>Create New</button>
 * </mcms-empty-state>
 * ```
 */
@Component({
	selector: 'mcms-empty-state',
	host: {
		'[class]': 'hostClasses()',
		role: 'status',
	},
	template: `
		<div class="mb-4">
			<ng-content select="[mcms-empty-state-icon]" />
		</div>
		@if (title()) {
			<h3 [class]="titleClasses()">{{ title() }}</h3>
		}
		@if (description()) {
			<p [class]="descriptionClasses()">{{ description() }}</p>
		}
		<ng-content select="[mcms-empty-state-description]" />
		<div class="mt-6">
			<ng-content select="[mcms-empty-state-action]" />
		</div>
		<ng-content />
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
	/** Title text to display */
	readonly title = input<string>();

	/** Description text to display */
	readonly description = input<string>();

	/** Size variant */
	readonly size = input<EmptyStateSize>('md');

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'flex flex-col items-center justify-center text-center';
		const paddingClasses = this.getPaddingClasses();
		return `${base} ${paddingClasses} ${this.class()}`.trim();
	});

	protected readonly titleClasses = computed(() => {
		const base = 'font-semibold text-foreground';
		const sizeClasses = this.getTitleSizeClasses();
		return `${base} ${sizeClasses}`.trim();
	});

	protected readonly descriptionClasses = computed(() => {
		const base = 'text-muted-foreground mt-2';
		const sizeClasses = this.getDescriptionSizeClasses();
		return `${base} ${sizeClasses}`.trim();
	});

	private getPaddingClasses(): string {
		const paddingMap: Record<EmptyStateSize, string> = {
			sm: 'p-6',
			md: 'p-8',
			lg: 'p-12',
		};
		return paddingMap[this.size()];
	}

	private getTitleSizeClasses(): string {
		const sizeMap: Record<EmptyStateSize, string> = {
			sm: 'text-base',
			md: 'text-lg',
			lg: 'text-xl',
		};
		return sizeMap[this.size()];
	}

	private getDescriptionSizeClasses(): string {
		const sizeMap: Record<EmptyStateSize, string> = {
			sm: 'text-sm max-w-sm',
			md: 'text-sm max-w-md',
			lg: 'text-base max-w-lg',
		};
		return sizeMap[this.size()];
	}
}

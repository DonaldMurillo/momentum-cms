import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { generatePaginationItems } from './pagination.types';

/**
 * Pagination navigation component.
 *
 * @example
 * ```html
 * <mcms-pagination
 *   [currentPage]="currentPage"
 *   [totalPages]="totalPages"
 *   (pageChange)="onPageChange($event)"
 * />
 * ```
 */
@Component({
	selector: 'mcms-pagination',
	host: {
		'[class]': 'hostClasses()',
		role: 'navigation',
		'aria-label': 'Pagination',
	},
	template: `
		<ul class="flex flex-row items-center gap-1">
			<!-- Previous button -->
			<li>
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
					[disabled]="currentPage() <= 1"
					(click)="goToPage(currentPage() - 1)"
					aria-label="Go to previous page"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m15 18-6-6 6-6" />
					</svg>
				</button>
			</li>

			<!-- Page numbers -->
			@for (item of paginationItems(); track $index) {
				<li>
					@if (item === 'ellipsis') {
						<span class="flex h-9 w-9 items-center justify-center">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="1" />
								<circle cx="19" cy="12" r="1" />
								<circle cx="5" cy="12" r="1" />
							</svg>
						</span>
					} @else {
						<button
							type="button"
							class="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors"
							[class.border]="item !== currentPage()"
							[class.border-input]="item !== currentPage()"
							[class.bg-background]="item !== currentPage()"
							[class.hover:bg-accent]="item !== currentPage()"
							[class.hover:text-accent-foreground]="item !== currentPage()"
							[class.bg-primary]="item === currentPage()"
							[class.text-primary-foreground]="item === currentPage()"
							[attr.aria-current]="item === currentPage() ? 'page' : null"
							(click)="goToPage(item)"
						>
							{{ item }}
						</button>
					}
				</li>
			}

			<!-- Next button -->
			<li>
				<button
					type="button"
					class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
					[disabled]="currentPage() >= totalPages()"
					(click)="goToPage(currentPage() + 1)"
					aria-label="Go to next page"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m9 18 6-6-6-6" />
					</svg>
				</button>
			</li>
		</ul>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
	/** Current active page (1-indexed). */
	readonly currentPage = input.required<number>();

	/** Total number of pages. */
	readonly totalPages = input.required<number>();

	/** Number of siblings to show on each side of current page. */
	readonly siblingCount = input(1);

	/** Additional CSS classes. */
	readonly class = input('');

	/** Emitted when page changes. */
	readonly pageChange = output<number>();

	readonly paginationItems = computed(() =>
		generatePaginationItems(this.currentPage(), this.totalPages(), this.siblingCount()),
	);

	readonly hostClasses = computed(() => {
		return `mx-auto flex w-full justify-center ${this.class()}`.trim();
	});

	goToPage(page: number): void {
		if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
			this.pageChange.emit(page);
		}
	}
}

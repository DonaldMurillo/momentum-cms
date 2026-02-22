/**
 * Analytics Dashboard — General Overview
 *
 * High-level system health view: total events, API metrics, active sessions,
 * device/browser breakdown, content operations, and a paginated event feed.
 * Covers all event categories (content, API, page, custom).
 *
 * For deep-dive page-level traffic analysis (per-URL visitors, per-page
 * referrer sources), see the Content Performance page at 'analytics/content'.
 */
import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	signal,
	OnInit,
	PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Badge,
	Skeleton,
} from '@momentumcms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroChartBarSquare,
	heroArrowTrendingUp,
	heroClock,
	heroUsers,
	heroDocumentText,
	heroArrowPath,
	heroMagnifyingGlass,
	heroDevicePhoneMobile,
	heroGlobeAlt,
	heroChevronLeft,
	heroChevronRight,
} from '@ng-icons/heroicons/outline';
import {
	AnalyticsService,
	type AnalyticsSummaryData,
	type AnalyticsEventData,
} from './analytics.service';
import { BlockAnalyticsWidgetComponent } from './widgets/block-analytics-widget.component';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

interface DateRangeOption {
	label: string;
	value: string;
	getFrom: () => string | undefined;
}

/**
 * Analytics Dashboard Page
 *
 * Displays analytics overview with metrics, event feed, content/device breakdown.
 * Loaded lazily via plugin admin route registration.
 */
@Component({
	selector: 'mcms-analytics-dashboard',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Badge,
		Skeleton,
		NgIcon,
		BlockAnalyticsWidgetComponent,
	],
	providers: [
		provideIcons({
			heroChartBarSquare,
			heroArrowTrendingUp,
			heroClock,
			heroUsers,
			heroDocumentText,
			heroArrowPath,
			heroMagnifyingGlass,
			heroDevicePhoneMobile,
			heroGlobeAlt,
			heroChevronLeft,
			heroChevronRight,
		}),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-4xl font-bold tracking-tight text-foreground">Analytics</h1>
					<p class="text-muted-foreground mt-3 text-lg">
						Monitor content activity and site performance
					</p>
				</div>
				<button
					class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
						bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
					(click)="refresh()"
					aria-label="Refresh analytics data"
				>
					<ng-icon name="heroArrowPath" size="16" aria-hidden="true" />
					Refresh
				</button>
			</div>
		</header>

		<!-- Date Range Selector -->
		<div class="flex gap-2 mb-6">
			@for (range of dateRanges; track range.value) {
				<button
					class="px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer border
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
					[class]="
						selectedRange() === range.value
							? 'bg-primary text-primary-foreground border-primary'
							: 'bg-background text-foreground border-border hover:bg-muted'
					"
					(click)="setDateRange(range)"
				>
					{{ range.label }}
				</button>
			}
		</div>

		<!-- Overview Cards -->
		<section class="mb-10">
			<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
				Overview
			</h2>
			@if (analytics.loading() && !analytics.summary()) {
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					@for (i of [1, 2, 3, 4]; track i) {
						<mcms-card>
							<mcms-card-header>
								<mcms-skeleton class="h-4 w-24" />
								<mcms-skeleton class="h-8 w-16 mt-2" />
							</mcms-card-header>
						</mcms-card>
					}
				</div>
			} @else if (analytics.summary(); as s) {
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					<!-- Total Events -->
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Total Events</mcms-card-description>
								<ng-icon
									name="heroChartBarSquare"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ s.totalEvents }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<!-- Content Operations -->
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Content Operations</mcms-card-description>
								<ng-icon
									name="heroDocumentText"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ contentOpsTotal(s) }}</span>
							</mcms-card-title>
							<p class="text-xs text-muted-foreground mt-1">
								{{ s.contentOperations.created }} created /
								{{ s.contentOperations.updated }} updated /
								{{ s.contentOperations.deleted }} deleted
							</p>
						</mcms-card-header>
					</mcms-card>

					<!-- API Requests -->
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>API Requests</mcms-card-description>
								<ng-icon
									name="heroArrowTrendingUp"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ s.apiMetrics.totalRequests }}</span>
							</mcms-card-title>
							@if (s.apiMetrics.avgDuration > 0) {
								<p class="text-xs text-muted-foreground mt-1">
									Avg. {{ s.apiMetrics.avgDuration }}ms response time
								</p>
							}
						</mcms-card-header>
					</mcms-card>

					<!-- Active Sessions -->
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Active Sessions</mcms-card-description>
								<ng-icon
									name="heroUsers"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ s.activeSessions }}</span>
							</mcms-card-title>
							<p class="text-xs text-muted-foreground mt-1">
								{{ s.activeVisitors }} unique visitors
							</p>
						</mcms-card-header>
					</mcms-card>
				</div>
			} @else if (analytics.error(); as err) {
				<mcms-card>
					<mcms-card-header>
						<mcms-card-title>Error loading analytics</mcms-card-title>
						<mcms-card-description>{{ err }}</mcms-card-description>
					</mcms-card-header>
					<mcms-card-content>
						<button class="text-sm text-primary hover:underline cursor-pointer" (click)="refresh()">
							Try again
						</button>
					</mcms-card-content>
				</mcms-card>
			}
		</section>

		<!-- Recent Activity -->
		<section class="mb-10">
			<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
				Recent Activity
			</h2>

			<!-- Search + Category filter row -->
			<div class="flex flex-col sm:flex-row gap-3 mb-4">
				<div class="relative flex-1 max-w-sm">
					<ng-icon
						name="heroMagnifyingGlass"
						class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
						size="16"
						aria-hidden="true"
					/>
					<input
						type="text"
						placeholder="Search events..."
						class="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background
							text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2
							focus:ring-primary/50"
						[value]="searchTerm()"
						(input)="onSearch($event)"
						aria-label="Search analytics events"
					/>
				</div>
				<div class="flex gap-2">
					@for (cat of categoryFilters; track cat.value) {
						<button
							class="px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer border
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
							[class]="
								selectedCategory() === cat.value
									? 'bg-primary text-primary-foreground border-primary'
									: 'bg-background text-foreground border-border hover:bg-muted'
							"
							(click)="setCategory(cat.value)"
						>
							{{ cat.label }}
						</button>
					}
				</div>
			</div>

			@if (analytics.loading() && !analytics.events()) {
				<div class="space-y-3">
					@for (i of [1, 2, 3, 4, 5]; track i) {
						<mcms-skeleton class="h-12 w-full" />
					}
				</div>
			} @else if (filteredEvents().length > 0) {
				<div class="border border-border rounded-lg overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm" role="table">
							<thead>
								<tr class="border-b border-border bg-muted/50">
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Time
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Category
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Event
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										URL
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Collection
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Device
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Source
									</th>
								</tr>
							</thead>
							<tbody>
								@for (event of filteredEvents(); track event.id) {
									<tr
										class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
									>
										<td class="px-4 py-3 text-muted-foreground whitespace-nowrap">
											{{ formatTime(event.timestamp) }}
										</td>
										<td class="px-4 py-3">
											<mcms-badge [variant]="getCategoryVariant(event.category)">
												{{ event.category }}
											</mcms-badge>
										</td>
										<td class="px-4 py-3 font-medium">{{ humanizeEventName(event.name) }}</td>
										<td
											class="px-4 py-3 text-muted-foreground max-w-48 truncate"
											[title]="event.context.url ?? ''"
										>
											@if (event.context.url) {
												{{ truncateUrl(event.context.url) }}
											} @else {
												<span class="text-muted-foreground/50">—</span>
											}
										</td>
										<td class="px-4 py-3 text-muted-foreground">
											@if (event.context.collection) {
												<mcms-badge variant="outline">{{ event.context.collection }}</mcms-badge>
											} @else {
												<span class="text-muted-foreground/50">—</span>
											}
										</td>
										<td class="px-4 py-3 text-muted-foreground whitespace-nowrap">
											@if (event.context.device) {
												{{ event.context.device }}
											} @else {
												<span class="text-muted-foreground/50">—</span>
											}
										</td>
										<td class="px-4 py-3 text-muted-foreground capitalize">
											{{ event.context.source }}
										</td>
									</tr>
								}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Pagination -->
				@if (totalPages() > 1) {
					<div class="flex items-center justify-between mt-4">
						<p class="text-sm text-muted-foreground">
							Page {{ currentPage() }} of {{ totalPages() }} ({{ analytics.events()?.total ?? 0 }}
							total)
						</p>
						<div class="flex gap-2">
							<button
								class="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border
									border-border bg-background hover:bg-muted transition-colors cursor-pointer
									disabled:opacity-50 disabled:cursor-not-allowed"
								[disabled]="currentPage() <= 1"
								(click)="goToPage(currentPage() - 1)"
								aria-label="Previous page"
							>
								<ng-icon name="heroChevronLeft" size="14" aria-hidden="true" />
								Prev
							</button>
							<button
								class="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border
									border-border bg-background hover:bg-muted transition-colors cursor-pointer
									disabled:opacity-50 disabled:cursor-not-allowed"
								[disabled]="currentPage() >= totalPages()"
								(click)="goToPage(currentPage() + 1)"
								aria-label="Next page"
							>
								Next
								<ng-icon name="heroChevronRight" size="14" aria-hidden="true" />
							</button>
						</div>
					</div>
				}
			} @else {
				<mcms-card>
					<mcms-card-content>
						<div class="flex flex-col items-center justify-center py-12 text-center">
							<ng-icon
								name="heroChartBarSquare"
								class="text-muted-foreground mb-4"
								size="40"
								aria-hidden="true"
							/>
							<p class="text-foreground font-medium">No events recorded</p>
							<p class="text-sm text-muted-foreground mt-1">
								Events will appear here as they are tracked
							</p>
						</div>
					</mcms-card-content>
				</mcms-card>
			}
		</section>

		<!-- Top Pages + Device Breakdown side by side -->
		@if (analytics.summary(); as s) {
			@if (s.topPages.length > 0 || hasDeviceData(s)) {
				<section class="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Top Pages -->
					@if (s.topPages.length > 0) {
						<mcms-card>
							<mcms-card-header>
								<div class="flex items-center gap-2">
									<ng-icon
										name="heroGlobeAlt"
										class="text-muted-foreground"
										size="18"
										aria-hidden="true"
									/>
									<mcms-card-title>Top Pages</mcms-card-title>
								</div>
							</mcms-card-header>
							<mcms-card-content>
								<div class="space-y-3">
									@for (page of s.topPages; track page.url) {
										<div class="flex items-center justify-between">
											<span class="text-sm text-foreground truncate max-w-64" [title]="page.url">
												{{ truncateUrl(page.url) }}
											</span>
											<mcms-badge variant="secondary">{{ page.count }}</mcms-badge>
										</div>
									}
								</div>
							</mcms-card-content>
						</mcms-card>
					}

					<!-- Device Breakdown -->
					@if (hasDeviceData(s)) {
						<mcms-card>
							<mcms-card-header>
								<div class="flex items-center gap-2">
									<ng-icon
										name="heroDevicePhoneMobile"
										class="text-muted-foreground"
										size="18"
										aria-hidden="true"
									/>
									<mcms-card-title>Devices & Browsers</mcms-card-title>
								</div>
							</mcms-card-header>
							<mcms-card-content>
								@if (deviceEntries(s).length > 0) {
									<h3
										class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"
									>
										Devices
									</h3>
									<div class="space-y-2 mb-4">
										@for (entry of deviceEntries(s); track entry.name) {
											<div class="flex items-center justify-between">
												<span class="text-sm text-foreground capitalize">{{ entry.name }}</span>
												<mcms-badge variant="outline">{{ entry.count }}</mcms-badge>
											</div>
										}
									</div>
								}
								@if (browserEntries(s).length > 0) {
									<h3
										class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"
									>
										Browsers
									</h3>
									<div class="space-y-2">
										@for (entry of browserEntries(s); track entry.name) {
											<div class="flex items-center justify-between">
												<span class="text-sm text-foreground">{{ entry.name }}</span>
												<mcms-badge variant="outline">{{ entry.count }}</mcms-badge>
											</div>
										}
									</div>
								}
							</mcms-card-content>
						</mcms-card>
					}
				</section>
			}
		}

		<!-- Content Breakdown -->
		@if (collectionEntries().length > 0) {
			<section>
				<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
					Content Breakdown
				</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					@for (entry of collectionEntries(); track entry.name) {
						<mcms-card>
							<mcms-card-header>
								<div class="flex items-center justify-between">
									<mcms-card-title>{{ entry.name }}</mcms-card-title>
									<mcms-badge variant="secondary">{{ entry.count }} events</mcms-badge>
								</div>
							</mcms-card-header>
						</mcms-card>
					}
				</div>
			</section>
		}

		<!-- Block Engagement -->
		<section class="mt-10">
			<mcms-block-analytics-widget />
		</section>
	`,
})
export class AnalyticsDashboardPage implements OnInit {
	protected readonly analytics = inject(AnalyticsService);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	/** Date range options */
	readonly dateRanges: DateRangeOption[] = [
		{
			label: '24h',
			value: '24h',
			getFrom: (): string => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
		},
		{
			label: '7d',
			value: '7d',
			getFrom: (): string => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
		},
		{
			label: '30d',
			value: '30d',
			getFrom: (): string => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
		},
		{ label: 'All', value: 'all', getFrom: (): undefined => undefined },
	];

	/** Category filter options */
	readonly categoryFilters = [
		{ value: 'all', label: 'All' },
		{ value: 'content', label: 'Content' },
		{ value: 'api', label: 'API' },
		{ value: 'page', label: 'Page' },
		{ value: 'custom', label: 'Custom' },
	];

	/** Selected date range */
	readonly selectedRange = signal('all');

	/** Selected category filter */
	readonly selectedCategory = signal('all');

	/** Search term */
	readonly searchTerm = signal('');

	/** Current page for pagination */
	readonly currentPage = signal(1);

	/** Events per page */
	private readonly pageSize = 20;

	/** Events from server query (filtered server-side by category when selected) */
	readonly filteredEvents = computed((): AnalyticsEventData[] => {
		const result = this.analytics.events();
		if (!result) return [];
		return result.events;
	});

	/** Total pages for pagination */
	readonly totalPages = computed((): number => {
		const result = this.analytics.events();
		if (!result) return 1;
		return Math.max(1, Math.ceil(result.total / result.limit));
	});

	/** Collection breakdown entries */
	readonly collectionEntries = computed((): { name: string; count: number }[] => {
		const s = this.analytics.summary();
		if (!s) return [];
		return Object.entries(s.byCollection)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count);
	});

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;

		// Hydrate filter state from URL query params
		const params = this.route.snapshot.queryParams;
		if (params['range'] && this.dateRanges.some((r) => r.value === params['range'])) {
			this.selectedRange.set(params['range']);
		}
		if (params['category'] && this.categoryFilters.some((c) => c.value === params['category'])) {
			this.selectedCategory.set(params['category']);
		}
		if (params['search']) {
			this.searchTerm.set(params['search']);
		}
		if (params['page']) {
			const page = parseInt(params['page'], 10);
			if (!isNaN(page) && page > 0) {
				this.currentPage.set(page);
			}
		}

		void this.refresh();
	}

	/**
	 * Refresh all analytics data.
	 */
	async refresh(): Promise<void> {
		const dateRange = this.dateRanges.find((r) => r.value === this.selectedRange());
		const from = dateRange?.getFrom();
		const search = this.searchTerm() || undefined;
		const page = this.currentPage();
		const category = this.selectedCategory();

		await Promise.all([
			this.analytics.fetchSummary({ from }),
			this.analytics.queryEvents({
				limit: this.pageSize,
				page,
				from,
				search,
				category: category !== 'all' ? category : undefined,
			}),
		]);
	}

	/**
	 * Set date range and refresh.
	 */
	setDateRange(range: DateRangeOption): void {
		this.selectedRange.set(range.value);
		this.currentPage.set(1);
		this.syncUrlParams();
		void this.refresh();
	}

	/**
	 * Set category filter and re-query server.
	 */
	setCategory(category: string): void {
		this.selectedCategory.set(category);
		this.currentPage.set(1);
		this.syncUrlParams();
		void this.refresh();
	}

	/**
	 * Handle search input.
	 */
	onSearch(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLInputElement) {
			this.searchTerm.set(target.value);
			this.currentPage.set(1);
			this.syncUrlParams();
			void this.refresh();
		}
	}

	/**
	 * Navigate to a specific page.
	 */
	goToPage(page: number): void {
		this.currentPage.set(page);
		this.syncUrlParams();
		void this.refresh();
	}

	/**
	 * Sync current filter state to URL query params.
	 */
	private syncUrlParams(): void {
		const queryParams: Record<string, string | null> = {
			range: this.selectedRange() !== 'all' ? this.selectedRange() : null,
			category: this.selectedCategory() !== 'all' ? this.selectedCategory() : null,
			search: this.searchTerm() || null,
			page: this.currentPage() > 1 ? String(this.currentPage()) : null,
		};
		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams,
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});
	}

	/**
	 * Get total content operations count.
	 */
	contentOpsTotal(s: AnalyticsSummaryData): number {
		return s.contentOperations.created + s.contentOperations.updated + s.contentOperations.deleted;
	}

	/**
	 * Check if summary has device/browser data.
	 */
	hasDeviceData(s: AnalyticsSummaryData): boolean {
		return (
			Object.keys(s.deviceBreakdown ?? {}).length > 0 ||
			Object.keys(s.browserBreakdown ?? {}).length > 0
		);
	}

	/**
	 * Get device entries sorted by count.
	 */
	deviceEntries(s: AnalyticsSummaryData): { name: string; count: number }[] {
		return Object.entries(s.deviceBreakdown ?? {})
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count);
	}

	/**
	 * Get browser entries sorted by count.
	 */
	browserEntries(s: AnalyticsSummaryData): { name: string; count: number }[] {
		return Object.entries(s.browserBreakdown ?? {})
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count);
	}

	/**
	 * Truncate URL for display.
	 */
	truncateUrl(url: string): string {
		try {
			const parsed = new URL(url, 'http://localhost');
			return parsed.pathname + parsed.search;
		} catch {
			return url.length > 50 ? url.slice(0, 47) + '...' : url;
		}
	}

	/**
	 * Format timestamp to relative time.
	 */
	formatTime(timestamp: string): string {
		const now = Date.now();
		const then = new Date(timestamp).getTime();
		const diff = now - then;

		if (diff < 60_000) return 'Just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return `${Math.floor(diff / 86_400_000)}d ago`;
	}

	/**
	 * Get badge variant for event category.
	 */
	getCategoryVariant(category: string): BadgeVariant {
		switch (category) {
			case 'content':
				return 'default';
			case 'api':
				return 'secondary';
			case 'admin':
				return 'warning';
			case 'page':
				return 'success';
			case 'custom':
				return 'outline';
			default:
				return 'secondary';
		}
	}

	/**
	 * Humanize event name (e.g., 'content_created' -> 'Content Created').
	 */
	humanizeEventName(name: string): string {
		return name
			.split(/[_-]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
}

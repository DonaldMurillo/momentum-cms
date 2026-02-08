import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	OnInit,
	PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Badge,
	Skeleton,
} from '@momentum-cms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroChartBarSquare,
	heroArrowTrendingUp,
	heroClock,
	heroUsers,
	heroDocumentText,
	heroArrowPath,
} from '@ng-icons/heroicons/outline';
import {
	AnalyticsService,
	type AnalyticsSummaryData,
	type AnalyticsEventData,
} from '../../services/analytics.service';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

/**
 * Analytics Dashboard Page
 *
 * Displays analytics overview with metrics, event feed, and content breakdown.
 * Loaded lazily via plugin admin route registration.
 */
@Component({
	selector: 'mcms-analytics-dashboard',
	imports: [Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Skeleton, NgIcon],
	providers: [
		provideIcons({
			heroChartBarSquare,
			heroArrowTrendingUp,
			heroClock,
			heroUsers,
			heroDocumentText,
			heroArrowPath,
		}),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<h1 class="text-4xl font-bold tracking-tight text-foreground">Analytics</h1>
			<p class="text-muted-foreground mt-3 text-lg">
				Monitor content activity and site performance
			</p>
		</header>

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

			<!-- Category filter buttons -->
			<div class="flex gap-2 mb-4">
				@for (cat of categoryFilters; track cat.value) {
					<button
						class="px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer border"
						[class]="
							selectedCategory === cat.value
								? 'bg-primary text-primary-foreground border-primary'
								: 'bg-background text-foreground border-border hover:bg-muted'
						"
						(click)="selectedCategory = cat.value"
					>
						{{ cat.label }}
					</button>
				}
			</div>

			@if (analytics.loading() && !analytics.events()) {
				<div class="space-y-3">
					@for (i of [1, 2, 3, 4, 5]; track i) {
						<mcms-skeleton class="h-12 w-full" />
					}
				</div>
			} @else if (filteredEvents().length > 0) {
				<div class="border border-border rounded-lg overflow-hidden">
					<table class="w-full text-sm" role="table">
						<thead>
							<tr class="border-b border-border bg-muted/50">
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Event</th>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Collection</th>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
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
									<td class="px-4 py-3 text-muted-foreground">
										@if (event.context.collection) {
											<mcms-badge variant="outline">{{ event.context.collection }}</mcms-badge>
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
	`,
})
export class AnalyticsDashboardPage implements OnInit {
	protected readonly analytics = inject(AnalyticsService);
	private readonly platformId = inject(PLATFORM_ID);

	/** Category filter options */
	readonly categoryFilters = [
		{ value: 'all', label: 'All' },
		{ value: 'content', label: 'Content' },
		{ value: 'api', label: 'API' },
		{ value: 'custom', label: 'Custom' },
	];

	/** Selected category filter */
	selectedCategory = 'all';

	/** Filtered events based on selected category */
	readonly filteredEvents = computed((): AnalyticsEventData[] => {
		const result = this.analytics.events();
		if (!result) return [];
		if (this.selectedCategory === 'all') return result.events;
		return result.events.filter((e) => e.category === this.selectedCategory);
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
		void this.refresh();
	}

	/**
	 * Refresh all analytics data.
	 */
	async refresh(): Promise<void> {
		await Promise.all([this.analytics.fetchSummary(), this.analytics.queryEvents({ limit: 50 })]);
	}

	/**
	 * Get total content operations count.
	 */
	contentOpsTotal(s: AnalyticsSummaryData): number {
		return s.contentOperations.created + s.contentOperations.updated + s.contentOperations.deleted;
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
			case 'custom':
				return 'outline';
			default:
				return 'secondary';
		}
	}

	/**
	 * Humanize event name (e.g., 'content_created' → 'Content Created').
	 */
	humanizeEventName(name: string): string {
		return name
			.split(/[_-]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
}

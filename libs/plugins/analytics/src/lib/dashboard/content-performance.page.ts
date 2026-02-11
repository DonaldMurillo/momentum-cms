/**
 * Content Performance — Deep-Dive Traffic Analysis
 *
 * Dedicated page for understanding which content drives the most traffic.
 * Aggregates page_view events by URL, ranking pages by views and showing
 * per-page unique visitor counts and referrer source breakdowns.
 *
 * Complements the Analytics Dashboard (general system overview) by providing
 * content-focused insights: URL traffic ranking, per-page referrer drill-down,
 * and visitor deduplication. Future: per-document block engagement via the
 * /api/analytics/content-performance endpoint.
 *
 * Registered as a plugin admin route at 'analytics/content'.
 */

import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
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
	heroGlobeAlt,
	heroUsers,
	heroEye,
	heroDocumentText,
	heroMagnifyingGlass,
	heroChevronDown,
	heroChevronUp,
} from '@ng-icons/heroicons/outline';
import { ContentPerformanceService, type TopPageEntry } from './content-performance.service';

interface DateRangeOption {
	label: string;
	value: string;
	getFrom: () => string | undefined;
}

@Component({
	selector: 'mcms-content-performance-page',
	imports: [Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Skeleton, NgIcon],
	providers: [
		provideIcons({
			heroGlobeAlt,
			heroUsers,
			heroEye,
			heroDocumentText,
			heroMagnifyingGlass,
			heroChevronDown,
			heroChevronUp,
		}),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-4xl font-bold tracking-tight text-foreground">Content Performance</h1>
					<p class="text-muted-foreground mt-3 text-lg">See which content gets the most traffic</p>
				</div>
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

		<!-- Summary Cards -->
		<section class="mb-8">
			@if (service.loading() && service.topPages().length === 0) {
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
					@for (i of [1, 2, 3]; track i) {
						<mcms-card>
							<mcms-card-header>
								<mcms-skeleton class="h-4 w-24" />
								<mcms-skeleton class="h-8 w-16 mt-2" />
							</mcms-card-header>
						</mcms-card>
					}
				</div>
			} @else {
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Total Views</mcms-card-description>
								<ng-icon
									name="heroEye"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ totalViews() }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Unique Visitors</mcms-card-description>
								<ng-icon
									name="heroUsers"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ totalVisitors() }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Pages</mcms-card-description>
								<ng-icon
									name="heroDocumentText"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ totalPages() }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>
				</div>
			}
		</section>

		<!-- Search -->
		<div class="relative max-w-sm mb-4">
			<ng-icon
				name="heroMagnifyingGlass"
				class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
				size="16"
				aria-hidden="true"
			/>
			<input
				type="text"
				placeholder="Search pages..."
				class="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background
					text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2
					focus:ring-primary/50"
				[value]="searchTerm()"
				(input)="onSearch($event)"
				aria-label="Search content pages"
			/>
		</div>

		<!-- Pages Table -->
		@if (service.loading() && service.topPages().length === 0) {
			<div class="space-y-3">
				@for (i of [1, 2, 3, 4, 5]; track i) {
					<mcms-skeleton class="h-12 w-full" />
				}
			</div>
		} @else if (service.error(); as err) {
			<mcms-card>
				<mcms-card-content>
					<p class="text-sm text-destructive">{{ err }}</p>
				</mcms-card-content>
			</mcms-card>
		} @else if (filteredPages().length > 0) {
			<div class="border border-border rounded-lg overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm" role="table">
						<thead>
							<tr class="border-b border-border bg-muted/50">
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground w-12">
									#
								</th>
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
									Page
								</th>
								<th scope="col" class="px-4 py-3 text-right font-medium text-muted-foreground">
									Views
								</th>
								<th scope="col" class="px-4 py-3 text-right font-medium text-muted-foreground">
									Visitors
								</th>
								<th
									scope="col"
									class="px-4 py-3 text-center font-medium text-muted-foreground w-12"
								>
									<span class="sr-only">Expand</span>
								</th>
							</tr>
						</thead>
						<tbody>
							@for (page of filteredPages(); track page.url; let idx = $index) {
								<tr
									class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer
										focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									tabindex="0"
									role="row"
									[attr.aria-label]="'Show referrers for ' + page.url"
									[attr.aria-expanded]="expandedRow() === page.url"
									(click)="toggleRow(page.url)"
									(keydown.enter)="toggleRow(page.url)"
									(keydown.space)="$event.preventDefault(); toggleRow(page.url)"
								>
									<td class="px-4 py-3 text-muted-foreground">
										{{ idx + 1 }}
									</td>
									<td class="px-4 py-3 font-medium" [title]="page.url">
										{{ page.url }}
									</td>
									<td class="px-4 py-3 text-right text-muted-foreground">
										{{ page.pageViews }}
									</td>
									<td class="px-4 py-3 text-right text-muted-foreground">
										{{ page.uniqueVisitors }}
									</td>
									<td class="px-4 py-3 text-center">
										<ng-icon
											[name]="expandedRow() === page.url ? 'heroChevronUp' : 'heroChevronDown'"
											size="16"
											class="text-muted-foreground"
											aria-hidden="true"
										/>
									</td>
								</tr>
								@if (expandedRow() === page.url) {
									<tr class="bg-muted/20">
										<td colspan="5" class="px-4 py-4">
											@if (page.referrers.length > 0) {
												<div>
													<h4
														class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"
													>
														Top Referrers
													</h4>
													<div class="flex flex-wrap gap-2">
														@for (ref of page.referrers; track ref.referrer) {
															<div
																class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border text-sm"
															>
																<span class="truncate max-w-48" [title]="ref.referrer">
																	{{ ref.referrer }}
																</span>
																<mcms-badge variant="secondary">
																	{{ ref.count }}
																</mcms-badge>
															</div>
														}
													</div>
												</div>
											} @else {
												<p class="text-sm text-muted-foreground">No referrer data available</p>
											}
										</td>
									</tr>
								}
							}
						</tbody>
					</table>
				</div>
			</div>
		} @else {
			<mcms-card>
				<mcms-card-content>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<ng-icon
							name="heroGlobeAlt"
							class="text-muted-foreground mb-4"
							size="40"
							aria-hidden="true"
						/>
						<p class="text-foreground font-medium">No page views recorded</p>
						<p class="text-sm text-muted-foreground mt-1">
							Page view events will appear here as visitors browse your site
						</p>
					</div>
				</mcms-card-content>
			</mcms-card>
		}
	`,
})
export class ContentPerformancePage implements OnInit {
	protected readonly service = inject(ContentPerformanceService);
	private readonly platformId = inject(PLATFORM_ID);

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

	readonly selectedRange = signal('all');
	readonly searchTerm = signal('');
	readonly expandedRow = signal<string | null>(null);

	readonly filteredPages = computed((): TopPageEntry[] => {
		const pages = this.service.topPages();
		const term = this.searchTerm().toLowerCase().trim();
		if (!term) return pages;
		return pages.filter((p) => p.url.toLowerCase().includes(term));
	});

	readonly totalViews = computed((): number => {
		const pages = this.service.topPages();
		let total = 0;
		for (const p of pages) {
			total += p.pageViews;
		}
		return total;
	});

	readonly totalVisitors = computed((): number => {
		const pages = this.service.topPages();
		let total = 0;
		for (const p of pages) {
			total += p.uniqueVisitors;
		}
		return total;
	});

	readonly totalPages = computed((): number => this.service.topPages().length);

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		void this.fetchData();
	}

	setDateRange(range: DateRangeOption): void {
		this.selectedRange.set(range.value);
		this.expandedRow.set(null);
		void this.fetchData();
	}

	onSearch(event: Event): void {
		if (event.target instanceof HTMLInputElement) {
			this.searchTerm.set(event.target.value);
		}
	}

	toggleRow(url: string): void {
		this.expandedRow.set(this.expandedRow() === url ? null : url);
	}

	private async fetchData(): Promise<void> {
		const range = this.dateRanges.find((r) => r.value === this.selectedRange());
		const from = range?.getFrom();
		await this.service.fetchTopPages({ from });
	}
}

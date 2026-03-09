/* eslint-disable @nx/enforce-module-boundaries -- Browser-safe admin route excluded from server build */
/**
 * Observability Dashboard
 *
 * Admin page showing system health, request metrics, collection operations,
 * recent traces, and metrics history. Loaded lazily via plugin admin route registration.
 */
import {
	Component,
	ChangeDetectionStrategy,
	inject,
	OnInit,
	OnDestroy,
	PLATFORM_ID,
	signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
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
	heroSignal,
	heroArrowPath,
	heroClock,
	heroServerStack,
	heroChartBarSquare,
	heroCpuChip,
	heroDocumentText,
	heroEye,
	heroArrowDownTray,
	heroTrash,
} from '@ng-icons/heroicons/outline';
import { OtelService, type OtelSummaryData, type SpanData } from './otel.service';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

type HistoryRange = 'hour' | 'day' | 'week';

@Component({
	selector: 'mcms-otel-dashboard',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Badge,
		Skeleton,
		NgIcon,
	],
	providers: [
		provideIcons({
			heroSignal,
			heroArrowPath,
			heroClock,
			heroServerStack,
			heroChartBarSquare,
			heroCpuChip,
			heroDocumentText,
			heroEye,
			heroArrowDownTray,
			heroTrash,
		}),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-4xl font-bold tracking-tight text-foreground">Observability</h1>
					<p class="text-muted-foreground mt-3 text-lg">
						System health, request metrics, and trace visibility
					</p>
				</div>
				<div class="flex items-center gap-3">
					<button
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
							transition-colors cursor-pointer
							focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						[class]="otel.live()
							? 'bg-green-600 text-white hover:bg-green-700'
							: 'border border-border bg-background text-foreground hover:bg-muted'"
						(click)="otel.toggleLive()"
						[attr.aria-label]="otel.live() ? 'Disable live updates' : 'Enable live updates (every 5s)'"
						[attr.aria-pressed]="otel.live()"
					>
						<span
							class="inline-block h-2 w-2 rounded-full"
							[class]="otel.live() ? 'bg-white animate-pulse' : 'bg-muted-foreground'"
							aria-hidden="true"
						></span>
						Live
					</button>
					<button
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
							bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer
							focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
							disabled:opacity-50 disabled:cursor-not-allowed"
						(click)="refresh()"
						[attr.aria-label]="otel.loading() ? 'Refreshing observability data' : 'Refresh observability data'"
						[disabled]="otel.loading()"
					>
						<ng-icon name="heroArrowPath" size="16" aria-hidden="true" />
						Refresh
					</button>
				</div>
			</div>
		</header>

		<div aria-live="polite" class="sr-only">
			@if (otel.loading()) { Loading observability data... }
		</div>

		<!-- System Health -->
		<section class="mb-10" aria-labelledby="system-health-heading">
			<h2 id="system-health-heading" class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
				System Health
			</h2>
			@if (otel.loading() && !otel.summary()) {
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading system health data">
					@for (i of [1, 2, 3]; track i) {
						<mcms-card>
							<mcms-card-header>
								<mcms-skeleton class="h-4 w-24" />
								<mcms-skeleton class="h-8 w-16 mt-2" />
							</mcms-card-header>
						</mcms-card>
					}
				</div>
			} @else if (otel.summary(); as s) {
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Uptime</mcms-card-description>
								<ng-icon name="heroClock" class="text-muted-foreground" size="20" aria-hidden="true" />
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ formatUptime(s.uptime) }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Active Requests</mcms-card-description>
								<ng-icon name="heroSignal" class="text-muted-foreground" size="20" aria-hidden="true" />
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ s.activeRequests }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Memory Usage</mcms-card-description>
								<ng-icon name="heroCpuChip" class="text-muted-foreground" size="20" aria-hidden="true" />
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ s.memoryUsageMb }} MB</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>
				</div>
			} @else if (otel.error(); as err) {
				<div role="alert">
					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Error loading observability data</mcms-card-title>
							<mcms-card-description>{{ err }}</mcms-card-description>
						</mcms-card-header>
						<mcms-card-content>
							<button
								class="text-sm text-primary hover:underline cursor-pointer
									focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								(click)="refresh()"
							>
								Try again
							</button>
						</mcms-card-content>
					</mcms-card>
				</div>
			}
		</section>

		<!-- Request Metrics -->
		@if (otel.summary(); as s) {
			<section class="mb-10" aria-labelledby="request-metrics-heading">
				<h2 id="request-metrics-heading" class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
					Request Metrics
				</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Total Requests</mcms-card-description>
								<ng-icon name="heroChartBarSquare" class="text-muted-foreground" size="20" aria-hidden="true" />
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ s.requestMetrics.totalRequests }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-description>Avg Duration</mcms-card-description>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ s.requestMetrics.avgDurationMs }}ms</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-description>Errors</mcms-card-description>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ s.requestMetrics.errorCount }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-description>Error Rate</mcms-card-description>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ errorRate(s) }}%</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>
				</div>

				<!-- By Method + By Status Code -->
				@if (methodEntries(s).length > 0 || statusEntries(s).length > 0) {
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
						@if (methodEntries(s).length > 0) {
							<mcms-card>
								<mcms-card-header>
									<mcms-card-title>By Method</mcms-card-title>
								</mcms-card-header>
								<mcms-card-content>
									<div class="space-y-2">
										@for (entry of methodEntries(s); track entry.name) {
											<div class="flex items-center justify-between">
												<span class="text-sm font-mono text-foreground">{{ entry.name }}</span>
												<mcms-badge variant="secondary">{{ entry.count }}</mcms-badge>
											</div>
										}
									</div>
								</mcms-card-content>
							</mcms-card>
						}

						@if (statusEntries(s).length > 0) {
							<mcms-card>
								<mcms-card-header>
									<mcms-card-title>By Status Code</mcms-card-title>
								</mcms-card-header>
								<mcms-card-content>
									<div class="space-y-2">
										@for (entry of statusEntries(s); track entry.name) {
											<div class="flex items-center justify-between">
												<span class="text-sm font-mono text-foreground">{{ entry.name }}</span>
												<mcms-badge [variant]="statusVariant(entry.name)">{{ entry.count }}</mcms-badge>
											</div>
										}
									</div>
								</mcms-card-content>
							</mcms-card>
						}
					</div>
				}
			</section>

			<!-- Collection Operations -->
			@if (s.collectionMetrics.length > 0) {
				<section class="mb-10" aria-labelledby="collection-ops-heading">
					<h2 id="collection-ops-heading" class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
						Collection Operations
					</h2>
					<div class="border border-border rounded-lg overflow-hidden">
						<div class="overflow-x-auto">
							<table class="w-full text-sm" aria-labelledby="collection-ops-heading">
								<thead>
									<tr class="border-b border-border bg-muted/50">
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Collection
										</th>
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Creates
										</th>
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Updates
										</th>
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Deletes
										</th>
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Avg Duration
										</th>
									</tr>
								</thead>
								<tbody>
									@for (col of s.collectionMetrics; track col.collection) {
										<tr class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
											<td class="px-4 py-3 font-medium">
												<mcms-badge variant="outline">{{ col.collection }}</mcms-badge>
											</td>
											<td class="px-4 py-3">{{ col.creates }}</td>
											<td class="px-4 py-3">{{ col.updates }}</td>
											<td class="px-4 py-3">{{ col.deletes }}</td>
											<td class="px-4 py-3 text-muted-foreground">{{ col.avgDurationMs }}ms</td>
										</tr>
									}
								</tbody>
							</table>
						</div>
					</div>
				</section>
			}

			<!-- Recent Traces -->
			@if (s.recentSpans.length > 0) {
				<section class="mb-10" aria-labelledby="recent-traces-heading">
					<h2 id="recent-traces-heading" class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
						Recent Traces
					</h2>
					<div class="border border-border rounded-lg overflow-hidden">
						<div class="overflow-x-auto">
							<table class="w-full text-sm" aria-labelledby="recent-traces-heading">
								<thead>
									<tr class="border-b border-border bg-muted/50">
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Time
										</th>
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Trace ID
										</th>
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Operation
										</th>
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Duration
										</th>
										<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
											Status
										</th>
									</tr>
								</thead>
								<tbody>
									@for (span of s.recentSpans; track span.spanId || $index) {
										<tr class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
											<td class="px-4 py-3 text-muted-foreground whitespace-nowrap">
												{{ formatTime(span.timestamp) }}
											</td>
											<td class="px-4 py-3 font-mono text-xs max-w-32 truncate">
												<span [attr.aria-label]="'Trace ID: ' + span.traceId" [title]="span.traceId">
													{{ truncateId(span.traceId) }}
												</span>
											</td>
											<td class="px-4 py-3 font-medium">{{ span.name }}</td>
											<td class="px-4 py-3 text-muted-foreground">{{ span.durationMs }}ms</td>
											<td class="px-4 py-3">
												<mcms-badge [variant]="spanStatusVariant(span)">{{ span.status }}</mcms-badge>
											</td>
										</tr>
									}
								</tbody>
							</table>
						</div>
					</div>
				</section>
			}
		}

		<!-- Metrics History -->
		<section class="mb-10" aria-labelledby="metrics-history-heading">
			<div class="flex items-center justify-between mb-4">
				<h2 id="metrics-history-heading" class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
					Metrics History
				</h2>
				<div class="flex items-center gap-2">
					@for (range of historyRanges; track range.key) {
						<button
							class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer
								focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							[class]="selectedRange() === range.key
								? 'bg-primary text-primary-foreground'
								: 'border border-border bg-background text-foreground hover:bg-muted'"
							(click)="selectRange(range.key)"
						>
							{{ range.label }}
						</button>
					}
				</div>
			</div>

			<div class="flex items-center gap-3 mb-4">
				<button
					class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md
						border border-border bg-background text-foreground hover:bg-muted
						transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
						focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					(click)="exportCsv()"
					[disabled]="otel.exporting()"
					aria-label="Export metrics history as CSV"
				>
					<ng-icon name="heroArrowDownTray" size="14" aria-hidden="true" />
					{{ otel.exporting() ? 'Exporting...' : 'Export CSV' }}
				</button>
				<button
					class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md
						transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
						focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					[class]="confirmingPurge()
						? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
						: 'border border-destructive/50 text-destructive hover:bg-destructive/10'"
					(click)="confirmPurge()"
					[disabled]="otel.purging()"
					aria-label="Clear all metrics history"
				>
					<ng-icon name="heroTrash" size="14" aria-hidden="true" />
					{{ otel.purging() ? 'Clearing...' : confirmingPurge() ? 'Confirm Clear' : 'Clear History' }}
				</button>
				@if (otel.historyTotal() > 0) {
					<span class="text-xs text-muted-foreground">
						{{ otel.historyTotal() }} snapshots stored
					</span>
				}
			</div>

			@if (otel.historyLoading()) {
				<div class="border border-border rounded-lg p-8" aria-busy="true">
					<div class="flex items-center justify-center gap-3 text-muted-foreground">
						<mcms-skeleton class="h-4 w-48" />
					</div>
				</div>
			} @else if (otel.history().length > 0) {
				<div class="border border-border rounded-lg overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm" aria-labelledby="metrics-history-heading">
							<thead>
								<tr class="border-b border-border bg-muted/50">
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Timestamp
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Requests
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Errors
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Avg Duration
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Memory
									</th>
								</tr>
							</thead>
							<tbody>
								@for (snap of otel.history(); track snap.id || $index) {
									<tr class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
										<td class="px-4 py-3 text-muted-foreground whitespace-nowrap">
											{{ formatSnapshotTime(snap.createdAt) }}
										</td>
										<td class="px-4 py-3 font-medium">{{ snap.totalRequests }}</td>
										<td class="px-4 py-3">
											<mcms-badge [variant]="snap.errorCount > 0 ? 'destructive' : 'secondary'">
												{{ snap.errorCount }}
											</mcms-badge>
										</td>
										<td class="px-4 py-3 text-muted-foreground">{{ snap.avgDurationMs }}ms</td>
										<td class="px-4 py-3 text-muted-foreground">{{ snap.memoryUsageMb }} MB</td>
									</tr>
								}
							</tbody>
						</table>
					</div>
				</div>
			} @else {
				<div class="border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
					No history snapshots found for this time range.
				</div>
			}
		</section>
	`,
})
export class OtelDashboardPage implements OnInit, OnDestroy {
	protected readonly otel = inject(OtelService);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly window = inject(DOCUMENT).defaultView;

	protected readonly selectedRange = signal<HistoryRange>('day');
	protected readonly confirmingPurge = signal(false);
	private purgeResetTimer: number | null = null;

	protected readonly historyRanges = [
		{ key: 'hour' as const, label: 'Last Hour' },
		{ key: 'day' as const, label: 'Last 24h' },
		{ key: 'week' as const, label: 'Last 7 Days' },
	];

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		void this.refresh();
		void this.loadHistory();
	}

	ngOnDestroy(): void {
		if (this.otel.live()) {
			this.otel.toggleLive();
		}
		if (this.purgeResetTimer != null) {
			this.window?.clearTimeout(this.purgeResetTimer);
		}
	}

	async refresh(): Promise<void> {
		await this.otel.fetchSummary();
	}

	selectRange(range: HistoryRange): void {
		this.selectedRange.set(range);
		void this.loadHistory();
	}

	exportCsv(): void {
		const { from } = this.getTimeRange();
		this.otel.exportCsv(from);
	}

	confirmPurge(): void {
		if (this.purgeResetTimer != null) {
			this.window?.clearTimeout(this.purgeResetTimer);
			this.purgeResetTimer = null;
		}

		if (this.confirmingPurge()) {
			this.confirmingPurge.set(false);
			void this.otel.purgeHistory();
		} else {
			this.confirmingPurge.set(true);
			this.purgeResetTimer = this.window?.setTimeout(() => {
				this.confirmingPurge.set(false);
				this.purgeResetTimer = null;
			}, 3000) ?? null;
		}
	}

	formatUptime(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
		return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
	}

	errorRate(s: OtelSummaryData): string {
		if (s.requestMetrics.totalRequests === 0) return '0';
		return ((s.requestMetrics.errorCount / s.requestMetrics.totalRequests) * 100).toFixed(1);
	}

	methodEntries(s: OtelSummaryData): { name: string; count: number }[] {
		return Object.entries(s.requestMetrics.byMethod)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count);
	}

	statusEntries(s: OtelSummaryData): { name: string; count: number }[] {
		return Object.entries(s.requestMetrics.byStatusCode)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => Number(a.name) - Number(b.name));
	}

	statusVariant(status: string): BadgeVariant {
		const code = Number(status);
		if (code >= 500) return 'destructive';
		if (code >= 400) return 'warning';
		if (code >= 200 && code < 300) return 'success';
		return 'secondary';
	}

	spanStatusVariant(span: SpanData): BadgeVariant {
		return span.status === 'ok' ? 'success' : 'destructive';
	}

	formatTime(timestamp: string): string {
		const now = Date.now();
		const then = new Date(timestamp).getTime();
		const diff = now - then;

		if (diff < 60_000) return 'Just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return `${Math.floor(diff / 86_400_000)}d ago`;
	}

	formatSnapshotTime(timestamp?: string): string {
		if (!timestamp) return '—';
		const date = new Date(timestamp);
		return date.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	truncateId(id: string): string {
		if (!id || id.length <= 12) return id || '—';
		return id.slice(0, 8) + '...';
	}

	private async loadHistory(): Promise<void> {
		const { from } = this.getTimeRange();
		await this.otel.fetchHistory(from);
	}

	private getTimeRange(): { from: string } {
		const now = Date.now();
		const range = this.selectedRange();

		let ms = 24 * 60 * 60 * 1000; // default: 24h
		if (range === 'hour') ms = 60 * 60 * 1000;
		else if (range === 'week') ms = 7 * 24 * 60 * 60 * 1000;

		return { from: new Date(now - ms).toISOString() };
	}
}

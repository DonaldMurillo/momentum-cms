/**
 * SEO Dashboard Page
 *
 * Overview of SEO health across all collections: average scores,
 * grade distribution, and per-document analysis results with recommendations.
 * Loaded lazily via plugin admin route registration.
 */

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
} from '@momentumcms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
	heroMagnifyingGlass,
	heroArrowPath,
	heroCheckCircle,
	heroExclamationTriangle,
	heroXCircle,
	heroDocumentText,
	heroChartBarSquare,
} from '@ng-icons/heroicons/outline';
import { SeoDashboardService, type SeoAnalysisEntry } from './seo-dashboard.service';
import { computeGrade } from '../seo-utils';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

@Component({
	selector: 'mcms-seo-dashboard',
	imports: [Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Skeleton, NgIcon],
	providers: [
		provideIcons({
			heroMagnifyingGlass,
			heroArrowPath,
			heroCheckCircle,
			heroExclamationTriangle,
			heroXCircle,
			heroDocumentText,
			heroChartBarSquare,
		}),
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-4xl font-bold tracking-tight text-foreground">SEO</h1>
					<p class="text-muted-foreground mt-3 text-lg">Monitor SEO health across your content</p>
				</div>
				<button
					class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
						bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none
						focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors cursor-pointer"
					(click)="refresh()"
					aria-label="Refresh SEO data"
				>
					<ng-icon name="heroArrowPath" size="16" aria-hidden="true" />
					Refresh
				</button>
			</div>
		</header>

		<!-- Overview Cards -->
		<section class="mb-10" aria-live="polite">
			<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
				Overview
			</h2>
			@if (seo.loading() && seo.analyses().length === 0) {
				<div
					class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
					aria-busy="true"
					aria-label="Loading SEO overview"
				>
					@for (i of [1, 2, 3, 4]; track i) {
						<mcms-card>
							<mcms-card-header>
								<mcms-skeleton class="h-4 w-24" />
								<mcms-skeleton class="h-8 w-16 mt-2" />
							</mcms-card-header>
						</mcms-card>
					}
				</div>
			} @else {
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					<!-- Total Analyzed -->
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Documents Analyzed</mcms-card-description>
								<ng-icon
									name="heroDocumentText"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ seo.analyses().length }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<!-- Average Score -->
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Average Score</mcms-card-description>
								<ng-icon
									name="heroChartBarSquare"
									class="text-muted-foreground"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ overallAvgScore() }}</span>
								<span class="text-lg text-muted-foreground">/100</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<!-- Good Grade Count -->
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Good</mcms-card-description>
								<ng-icon
									name="heroCheckCircle"
									class="text-green-500"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{ gradeCount('good') }}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>

					<!-- Needs Attention -->
					<mcms-card>
						<mcms-card-header>
							<div class="flex items-center justify-between">
								<mcms-card-description>Needs Attention</mcms-card-description>
								<ng-icon
									name="heroExclamationTriangle"
									class="text-yellow-500"
									size="20"
									aria-hidden="true"
								/>
							</div>
							<mcms-card-title>
								<span class="text-3xl font-bold">{{
									gradeCount('warning') + gradeCount('poor')
								}}</span>
							</mcms-card-title>
						</mcms-card-header>
					</mcms-card>
				</div>
			}
		</section>

		<!-- Collection Breakdown -->
		@if (seo.summaries().length > 0) {
			<section class="mb-10">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
					By Collection
				</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					@for (summary of seo.summaries(); track summary.collection) {
						<mcms-card>
							<mcms-card-header>
								<div class="flex items-center justify-between">
									<mcms-card-title>{{ summary.collection }}</mcms-card-title>
									<mcms-badge [variant]="getGradeVariant(computeGrade(summary.avgScore))">
										{{ summary.avgScore }}/100
									</mcms-badge>
								</div>
								<mcms-card-description>
									{{ summary.totalDocuments }} documents analyzed
								</mcms-card-description>
							</mcms-card-header>
							<mcms-card-content>
								<div class="flex gap-4 text-sm">
									<span class="text-green-600">{{ summary.gradeDistribution.good }} good</span>
									<span class="text-yellow-600"
										>{{ summary.gradeDistribution.warning }} warning</span
									>
									<span class="text-red-600">{{ summary.gradeDistribution.poor }} poor</span>
								</div>
							</mcms-card-content>
						</mcms-card>
					}
				</div>
			</section>
		}

		<!-- Recent Analyses -->
		@if (recentAnalyses().length > 0) {
			<section class="mb-10">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
					Recent Analyses
				</h2>
				<div class="border border-border rounded-lg overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<caption class="sr-only">
								Recent SEO analysis results
							</caption>
							<thead>
								<tr class="border-b border-border bg-muted/50">
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Collection
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Document
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Score
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Grade
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Keyword
									</th>
									<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
										Analyzed
									</th>
								</tr>
							</thead>
							<tbody>
								@for (entry of recentAnalyses(); track entry.id) {
									<tr
										class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
									>
										<td class="px-4 py-3">
											<mcms-badge variant="outline">{{ entry.collection }}</mcms-badge>
										</td>
										<td class="px-4 py-3 font-mono text-xs text-muted-foreground">
											{{ entry.documentId }}
										</td>
										<td class="px-4 py-3 font-bold">{{ entry.score }}</td>
										<td class="px-4 py-3">
											<mcms-badge [variant]="getGradeVariant(entry.grade)">
												{{ entry.grade }}
											</mcms-badge>
										</td>
										<td class="px-4 py-3 text-muted-foreground">
											{{ entry.focusKeyword ?? '—' }}
										</td>
										<td class="px-4 py-3 text-muted-foreground whitespace-nowrap">
											{{ formatTime(entry.analyzedAt) }}
										</td>
									</tr>
								}
							</tbody>
						</table>
					</div>
				</div>
			</section>
		}

		<!-- Error state -->
		@if (seo.error(); as err) {
			<mcms-card role="alert">
				<mcms-card-header>
					<mcms-card-title>Error loading SEO data</mcms-card-title>
					<mcms-card-description>{{ err }}</mcms-card-description>
				</mcms-card-header>
				<mcms-card-content>
					<button
						class="text-sm text-primary hover:underline focus-visible:outline-none
							focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
						(click)="refresh()"
					>
						Try again
					</button>
				</mcms-card-content>
			</mcms-card>
		}

		<!-- Empty state -->
		@if (!seo.loading() && seo.analyses().length === 0 && !seo.error()) {
			<mcms-card>
				<mcms-card-content>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<ng-icon
							name="heroMagnifyingGlass"
							class="text-muted-foreground mb-4"
							size="40"
							aria-hidden="true"
						/>
						<p class="text-foreground font-medium">No SEO analyses yet</p>
						<p class="text-sm text-muted-foreground mt-1">
							Analyses will appear here as documents with SEO fields are saved
						</p>
					</div>
				</mcms-card-content>
			</mcms-card>
		}
	`,
})
export class SeoDashboardPage implements OnInit {
	protected readonly seo = inject(SeoDashboardService);
	private readonly platformId = inject(PLATFORM_ID);

	/** Overall average score across all analyses */
	readonly overallAvgScore = computed((): number => {
		const analyses = this.seo.analyses();
		if (analyses.length === 0) return 0;
		const total = analyses.reduce((sum, a) => sum + a.score, 0);
		return Math.round(total / analyses.length);
	});

	/** First 20 analyses (server returns newest first via sort=-analyzedAt) */
	readonly recentAnalyses = computed((): SeoAnalysisEntry[] => {
		return this.seo.analyses().slice(0, 20);
	});

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		void this.refresh();
	}

	/**
	 * Refresh SEO data.
	 */
	async refresh(): Promise<void> {
		await this.seo.fetchAnalyses();
	}

	/**
	 * Count entries with a specific grade.
	 */
	gradeCount(grade: 'good' | 'warning' | 'poor'): number {
		return this.seo.analyses().filter((a) => a.grade === grade).length;
	}

	/** Compute grade from score — delegates to shared utility. */
	protected readonly computeGrade = computeGrade;

	/**
	 * Get badge variant for grade.
	 */
	getGradeVariant(grade: string): BadgeVariant {
		switch (grade) {
			case 'good':
				return 'success';
			case 'warning':
				return 'warning';
			case 'poor':
				return 'destructive';
			default:
				return 'secondary';
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
}

/**
 * SEO Dashboard Service
 *
 * Injectable service for fetching SEO analysis data from the server.
 * Provides signals for reactive data binding.
 */

import { Injectable, signal } from '@angular/core';

/**
 * SEO analysis entry returned by the API.
 */
export interface SeoAnalysisEntry {
	id: string;
	collection: string;
	documentId: string;
	score: number;
	grade: 'good' | 'warning' | 'poor';
	rules: Array<{
		id: string;
		name: string;
		score: number;
		weight: number;
		recommendation: string | null;
	}>;
	focusKeyword?: string;
	analyzedAt: string;
}

/**
 * Aggregated SEO summary per collection.
 */
export interface SeoCollectionSummary {
	collection: string;
	totalDocuments: number;
	avgScore: number;
	gradeDistribution: { good: number; warning: number; poor: number };
}

@Injectable({ providedIn: 'root' })
export class SeoDashboardService {
	/** Loading state */
	readonly loading = signal(false);

	/** Error state */
	readonly error = signal<string | null>(null);

	/** All analysis entries */
	readonly analyses = signal<SeoAnalysisEntry[]>([]);

	/** Collection summaries */
	readonly summaries = signal<SeoCollectionSummary[]>([]);

	/**
	 * Fetch SEO analysis entries from the API.
	 */
	async fetchAnalyses(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const response = await fetch('/api/seo/analyses?limit=500&sort=-analyzedAt');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = await response.json();
			const docs: SeoAnalysisEntry[] = data.docs ?? [];
			this.analyses.set(docs);
			this.summaries.set(this.buildSummaries(docs));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.error.set(message);
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Build per-collection summaries from analysis entries.
	 */
	private buildSummaries(entries: SeoAnalysisEntry[]): SeoCollectionSummary[] {
		const byCollection = new Map<string, SeoAnalysisEntry[]>();
		for (const entry of entries) {
			const existing = byCollection.get(entry.collection) ?? [];
			existing.push(entry);
			byCollection.set(entry.collection, existing);
		}

		const summaries: SeoCollectionSummary[] = [];
		for (const [collection, docs] of byCollection) {
			const totalScore = docs.reduce((sum, d) => sum + d.score, 0);
			const gradeDistribution = { good: 0, warning: 0, poor: 0 };
			for (const doc of docs) {
				gradeDistribution[doc.grade]++;
			}
			summaries.push({
				collection,
				totalDocuments: docs.length,
				avgScore: docs.length > 0 ? Math.round(totalScore / docs.length) : 0,
				gradeDistribution,
			});
		}
		return summaries.sort((a, b) => a.avgScore - b.avgScore);
	}
}

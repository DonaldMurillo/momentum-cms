/**
 * Observability Service
 *
 * Injectable service for fetching OTel metrics data from the server.
 * Provides signals for reactive data binding in the dashboard.
 */

import { DOCUMENT } from '@angular/common';
import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import type { OtelSummaryData, OtelSnapshotData } from '../otel-plugin.types';

// Re-export for dashboard component convenience
export type { OtelSummaryData, SpanRecord as SpanData, OtelSnapshotData } from '../otel-plugin.types';

const DEFAULT_POLL_INTERVAL_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class OtelService implements OnDestroy {
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly summary = signal<OtelSummaryData | null>(null);
	readonly live = signal(false);

	readonly history = signal<OtelSnapshotData[]>([]);
	readonly historyTotal = signal(0);
	readonly historyLoading = signal(false);
	readonly exporting = signal(false);
	readonly purging = signal(false);

	private readonly document = inject(DOCUMENT);
	private readonly window = this.document.defaultView;
	private pollTimer: number | null = null;

	ngOnDestroy(): void {
		this.stopPolling();
	}

	toggleLive(intervalMs = DEFAULT_POLL_INTERVAL_MS): void {
		if (this.live()) {
			this.stopPolling();
		} else {
			this.startPolling(intervalMs);
		}
	}

	async fetchSummary(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const response = await fetch('/api/otel/summary');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data: OtelSummaryData = await response.json();
			this.summary.set(data);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.error.set(message);
		} finally {
			this.loading.set(false);
		}
	}

	async fetchHistory(from?: string, to?: string): Promise<void> {
		this.historyLoading.set(true);

		try {
			const params = new URLSearchParams();
			if (from) params.set('from', from);
			if (to) params.set('to', to);
			params.set('limit', '100');

			const response = await fetch(`/api/otel/history?${params.toString()}`);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = await response.json();
			this.history.set(Array.isArray(data.snapshots) ? data.snapshots : []);
			this.historyTotal.set(typeof data.total === 'number' ? data.total : 0);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.error.set(message);
		} finally {
			this.historyLoading.set(false);
		}
	}

	exportCsv(from?: string, to?: string): void {
		this.exporting.set(true);

		const params = new URLSearchParams();
		if (from) params.set('from', from);
		if (to) params.set('to', to);

		const url = `/api/otel/export?${params.toString()}`;
		const link = this.document.createElement('a');
		link.href = url;
		link.download = '';
		link.style.display = 'none';
		this.document.body.appendChild(link);
		link.click();
		this.document.body.removeChild(link);

		// The browser handles the download natively; clear exporting after a delay
		this.window?.setTimeout(() => this.exporting.set(false), 2000);
	}

	async purgeHistory(): Promise<void> {
		this.purging.set(true);

		try {
			const response = await fetch('/api/otel/history', { method: 'DELETE' });
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			this.history.set([]);
			this.historyTotal.set(0);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.error.set(message);
		} finally {
			this.purging.set(false);
		}
	}

	private startPolling(intervalMs: number): void {
		this.stopPolling();
		this.live.set(true);
		this.pollTimer = this.window?.setInterval(() => void this.fetchSummary(), intervalMs) ?? null;
	}

	private stopPolling(): void {
		if (this.pollTimer != null) {
			this.window?.clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		this.live.set(false);
	}
}

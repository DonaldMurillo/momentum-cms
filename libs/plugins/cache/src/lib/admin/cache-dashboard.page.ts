/**
 * Cache Dashboard Page
 *
 * Admin UI for viewing cache statistics and manually purging cached entries.
 */

import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { CacheStats } from '../cache-adapter.types';

@Component({
	selector: 'mcms-cache-dashboard',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-4xl' },
	template: `
		<div class="space-y-6 p-6">
			<div class="flex items-center justify-between">
				<h1 class="text-2xl font-semibold">Cache</h1>
				<div class="flex gap-2">
					<button
						class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
						(click)="purgeAll()"
						[disabled]="purging()"
					>
						{{ purging() ? 'Purging...' : 'Purge All' }}
					</button>
					<button
						class="rounded-md bg-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600"
						(click)="refresh()"
						[disabled]="loading()"
					>
						Refresh
					</button>
				</div>
			</div>

			@if (loading() && !stats()) {
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					@for (_ of [1, 2, 3, 4]; track $index) {
						<div class="h-24 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700"></div>
					}
				</div>
			} @else if (error()) {
				<div
					class="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
				>
					{{ error() }}
				</div>
			} @else if (stats(); as s) {
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-lg border bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
						<p class="text-sm text-neutral-500 dark:text-neutral-400">Entries</p>
						<p class="text-2xl font-bold">{{ s.size }}</p>
					</div>
					<div class="rounded-lg border bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
						<p class="text-sm text-neutral-500 dark:text-neutral-400">Hit Rate</p>
						<p class="text-2xl font-bold">{{ s.hitRate.toFixed(1) }}%</p>
					</div>
					<div class="rounded-lg border bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
						<p class="text-sm text-neutral-500 dark:text-neutral-400">Hits / Misses</p>
						<p class="text-2xl font-bold">{{ s.hits }} / {{ s.misses }}</p>
					</div>
					<div class="rounded-lg border bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
						<p class="text-sm text-neutral-500 dark:text-neutral-400">Evictions</p>
						<p class="text-2xl font-bold">{{ s.evictions ?? 0 }}</p>
					</div>
				</div>

				@if (totalRequests() > 0) {
					<div class="rounded-lg border bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
						<h2 class="mb-2 text-lg font-medium">Hit Rate Bar</h2>
						<div class="h-4 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
							<div
								class="h-full rounded-full bg-green-500 transition-all"
								[style.width.%]="s.hitRate"
							></div>
						</div>
						<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
							{{ s.hits }} hits out of {{ totalRequests() }} total requests
						</p>
					</div>
				}
			}

			@if (purgeMessage()) {
				<div
					class="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
				>
					{{ purgeMessage() }}
				</div>
			}
		</div>
	`,
})
export class CacheDashboardPage {
	private readonly http = inject(HttpClient);

	readonly stats = signal<CacheStats | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly purging = signal(false);
	readonly purgeMessage = signal<string | null>(null);

	readonly totalRequests = computed(() => {
		const s = this.stats();
		return s ? s.hits + s.misses : 0;
	});

	constructor() {
		this.refresh();
	}

	refresh(): void {
		this.loading.set(true);
		this.error.set(null);
		this.http.get<CacheStats>('/api/cache/stats').subscribe({
			next: (data) => {
				this.stats.set(data);
				this.loading.set(false);
			},
			error: (err: unknown) => {
				const message = err instanceof Error ? err.message : 'Failed to load cache stats';
				this.error.set(message);
				this.loading.set(false);
			},
		});
	}

	purgeAll(): void {
		this.purging.set(true);
		this.purgeMessage.set(null);
		this.http.post<{ purged: string }>('/api/cache/purge', {}).subscribe({
			next: () => {
				this.purgeMessage.set('Cache purged successfully');
				this.purging.set(false);
				this.refresh();
			},
			error: () => {
				this.purgeMessage.set('Failed to purge cache');
				this.purging.set(false);
			},
		});
	}
}

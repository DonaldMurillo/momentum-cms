/**
 * Sitemap Settings Admin Page
 *
 * Per-collection sitemap configuration: include/exclude, priority, change frequency.
 * Uses the custom `/api/seo/sitemap-settings` endpoint (seo-sitemap-settings is managed).
 * Registered as a plugin admin route at 'seo/sitemap'.
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
	Button,
	Switch,
	DialogService,
} from '@momentumcms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMap, heroArrowPath } from '@ng-icons/heroicons/outline';
import { SitemapSettingsFormDialog } from './sitemap-settings-form.dialog';
import type { SitemapSettingsEntry } from './sitemap-settings-form.dialog';

function parseSettingsEntry(raw: unknown): SitemapSettingsEntry | null {
	if (raw == null || typeof raw !== 'object') return null;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed via typeof check above
	const doc = raw as Record<string, unknown>;
	if (typeof doc['collection'] !== 'string') return null;

	return {
		collection: doc['collection'],
		includeInSitemap: doc['includeInSitemap'] !== false,
		priority: doc['priority'] != null ? Number(doc['priority']) : null,
		changeFreq: typeof doc['changeFreq'] === 'string' ? doc['changeFreq'] : null,
		id: typeof doc['id'] === 'string' ? doc['id'] : null,
	};
}

@Component({
	selector: 'mcms-sitemap-settings-page',
	imports: [
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Badge,
		Skeleton,
		Button,
		Switch,
		NgIcon,
	],
	providers: [provideIcons({ heroMap, heroArrowPath })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block max-w-6xl' },
	template: `
		<header class="mb-10">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-4xl font-bold tracking-tight text-foreground">Sitemap</h1>
					<p class="text-muted-foreground mt-3 text-lg">
						Control which collections appear in the XML sitemap
					</p>
				</div>
				<button
					mcms-button
					variant="outline"
					size="sm"
					(click)="refresh()"
					ariaLabel="Refresh sitemap settings"
				>
					<ng-icon name="heroArrowPath" size="16" aria-hidden="true" />
					Refresh
				</button>
			</div>
		</header>

		<!-- Summary Cards -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
			<mcms-card>
				<mcms-card-header>
					<div class="flex items-center justify-between">
						<mcms-card-description>Total Collections</mcms-card-description>
						<ng-icon name="heroMap" class="text-muted-foreground" size="20" aria-hidden="true" />
					</div>
					<mcms-card-title>
						<span class="text-3xl font-bold">{{ totalCollections() }}</span>
					</mcms-card-title>
				</mcms-card-header>
			</mcms-card>
			<mcms-card>
				<mcms-card-header>
					<mcms-card-description>In Sitemap</mcms-card-description>
					<mcms-card-title>
						<span class="text-3xl font-bold text-emerald-600">{{ includedCount() }}</span>
					</mcms-card-title>
				</mcms-card-header>
			</mcms-card>
			<mcms-card>
				<mcms-card-header>
					<mcms-card-description>Excluded</mcms-card-description>
					<mcms-card-title>
						<span class="text-3xl font-bold text-muted-foreground">{{ excludedCount() }}</span>
					</mcms-card-title>
				</mcms-card-header>
			</mcms-card>
		</div>

		<!-- Settings Table -->
		@if (loading() && settings().length === 0) {
			<div class="space-y-3" aria-busy="true">
				@for (i of [1, 2, 3]; track i) {
					<mcms-skeleton class="h-14 w-full" />
				}
			</div>
		} @else if (settings().length > 0) {
			<div class="border border-border rounded-lg overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm" role="table">
						<caption class="sr-only">
							Sitemap settings per collection
						</caption>
						<thead>
							<tr class="border-b border-border bg-muted/50">
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
									Collection
								</th>
								<th scope="col" class="px-4 py-3 text-center font-medium text-muted-foreground">
									In Sitemap
								</th>
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
									Priority
								</th>
								<th scope="col" class="px-4 py-3 text-left font-medium text-muted-foreground">
									Frequency
								</th>
								<th scope="col" class="px-4 py-3 text-right font-medium text-muted-foreground">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							@for (entry of settings(); track entry.collection) {
								<tr
									class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
								>
									<td class="px-4 py-3 font-medium text-foreground">
										{{ entry.collection }}
									</td>
									<td class="px-4 py-3 text-center">
										<mcms-switch
											[value]="entry.includeInSitemap"
											(valueChange)="toggleInclude(entry)"
											ariaLabel="Toggle sitemap inclusion"
										/>
									</td>
									<td class="px-4 py-3 text-muted-foreground">
										{{ entry.priority != null ? entry.priority : '—' }}
									</td>
									<td class="px-4 py-3">
										@if (entry.changeFreq) {
											<mcms-badge variant="outline">{{ entry.changeFreq }}</mcms-badge>
										} @else {
											<span class="text-muted-foreground">—</span>
										}
									</td>
									<td class="px-4 py-3 text-right">
										<button
											mcms-button
											variant="ghost"
											size="sm"
											(click)="openEditDialog(entry)"
											ariaLabel="Edit settings"
										>
											Edit
										</button>
									</td>
								</tr>
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
							name="heroMap"
							class="text-muted-foreground mb-4"
							size="40"
							aria-hidden="true"
						/>
						<p class="text-foreground font-medium">No SEO-enabled collections</p>
						<p class="text-sm text-muted-foreground mt-1">
							Add SEO fields to your collections to configure sitemap settings
						</p>
					</div>
				</mcms-card-content>
			</mcms-card>
		}

		<!-- Error state -->
		@if (error(); as err) {
			<mcms-card role="alert" class="mt-6">
				<mcms-card-header>
					<mcms-card-title>Error loading sitemap settings</mcms-card-title>
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
	`,
})
export class SitemapSettingsPage implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly dialog = inject(DialogService);

	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly settings = signal<SitemapSettingsEntry[]>([]);

	readonly totalCollections = computed((): number => this.settings().length);
	readonly includedCount = computed(
		(): number => this.settings().filter((s) => s.includeInSitemap).length,
	);
	readonly excludedCount = computed(
		(): number => this.settings().filter((s) => !s.includeInSitemap).length,
	);

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		void this.fetchSettings();
	}

	refresh(): void {
		void this.fetchSettings();
	}

	openEditDialog(entry: SitemapSettingsEntry): void {
		const ref = this.dialog.open(SitemapSettingsFormDialog, {
			data: { entry },
			width: '28rem',
		});

		ref.afterClosed.subscribe((result) => {
			if (result === 'saved') void this.fetchSettings();
		});
	}

	async toggleInclude(entry: SitemapSettingsEntry): Promise<void> {
		if (!isPlatformBrowser(this.platformId)) return;

		const newValue = !entry.includeInSitemap;

		// Optimistic update
		this.settings.update((list) =>
			list.map((s) =>
				s.collection === entry.collection ? { ...s, includeInSitemap: newValue } : s,
			),
		);

		try {
			const res = await fetch(`/api/seo/sitemap-settings/${entry.collection}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ includeInSitemap: newValue }),
			});
			if (!res.ok) throw new Error('Failed');
		} catch {
			// Revert on error
			this.settings.update((list) =>
				list.map((s) =>
					s.collection === entry.collection
						? { ...s, includeInSitemap: entry.includeInSitemap }
						: s,
				),
			);
		}
	}

	private async fetchSettings(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);
		try {
			const res = await fetch('/api/seo/sitemap-settings');
			if (!res.ok) {
				this.error.set(`HTTP ${res.status}`);
				return;
			}

			const data: unknown = await res.json();
			if (data == null || typeof data !== 'object') return;
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed via typeof check above
			const body = data as Record<string, unknown>;
			if (!Array.isArray(body['settings'])) return;

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated as array above
			const entries = (body['settings'] as unknown[])
				.map(parseSettingsEntry)
				.filter((e): e is SitemapSettingsEntry => e != null);

			this.settings.set(entries);
		} catch {
			this.error.set('Failed to load sitemap settings');
		} finally {
			this.loading.set(false);
		}
	}
}

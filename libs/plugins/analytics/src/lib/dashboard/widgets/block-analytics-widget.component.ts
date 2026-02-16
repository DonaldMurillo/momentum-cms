/**
 * Block Analytics Widget
 *
 * Displays per-block-type engagement metrics: impressions, hovers, and hover rate.
 * Fetches block_impression and block_hover events from the analytics query endpoint.
 */

import {
	Component,
	ChangeDetectionStrategy,
	signal,
	computed,
	OnInit,
	inject,
	PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from '@momentumcms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCubeTransparent } from '@ng-icons/heroicons/outline';

interface BlockMetrics {
	blockType: string;
	impressions: number;
	hovers: number;
	hoverRate: number;
}

import { isRecord } from '../../utils/type-guards';

interface EventEntry {
	properties: Record<string, unknown>;
}

function parseEventEntries(data: unknown): EventEntry[] {
	if (!isRecord(data) || !Array.isArray(data['events'])) return [];
	const result: EventEntry[] = [];
	for (const item of data['events']) {
		if (isRecord(item) && isRecord(item['properties'])) {
			result.push({ properties: item['properties'] });
		}
	}
	return result;
}

@Component({
	selector: 'mcms-block-analytics-widget',
	imports: [Card, CardHeader, CardTitle, CardContent, Badge, Skeleton, NgIcon],
	providers: [provideIcons({ heroCubeTransparent })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		<mcms-card>
			<mcms-card-header>
				<div class="flex items-center gap-2">
					<ng-icon
						name="heroCubeTransparent"
						class="text-muted-foreground"
						size="18"
						aria-hidden="true"
					/>
					<mcms-card-title>Block Engagement</mcms-card-title>
				</div>
			</mcms-card-header>
			<mcms-card-content>
				@if (loading() && metrics().length === 0) {
					<div class="space-y-3">
						@for (i of [1, 2, 3]; track i) {
							<mcms-skeleton class="h-8 w-full" />
						}
					</div>
				} @else if (metrics().length > 0) {
					<div class="space-y-3">
						@for (m of metrics(); track m.blockType) {
							<div class="flex items-center justify-between gap-4">
								<div class="flex items-center gap-2 min-w-0">
									<mcms-badge variant="outline">{{ m.blockType }}</mcms-badge>
								</div>
								<div class="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
									<span title="Impressions">{{ m.impressions }} views</span>
									<span title="Hovers">{{ m.hovers }} hovers</span>
									<mcms-badge [variant]="m.hoverRate > 5 ? 'success' : 'secondary'">
										{{ m.hoverRate.toFixed(1) }}% hover
									</mcms-badge>
								</div>
							</div>
							<!-- Bar visualization -->
							<div
								class="flex gap-1 h-2"
								role="group"
								[attr.aria-label]="m.blockType + ' engagement bars'"
							>
								<div
									class="bg-primary/60 rounded-full"
									role="meter"
									[attr.aria-valuenow]="m.impressions"
									[attr.aria-valuemin]="0"
									[attr.aria-label]="'Impressions: ' + m.impressions"
									[style.width.%]="barWidth(m.impressions)"
								></div>
								<div
									class="bg-primary rounded-full"
									role="meter"
									[attr.aria-valuenow]="m.hovers"
									[attr.aria-valuemin]="0"
									[attr.aria-label]="'Hovers: ' + m.hovers"
									[style.width.%]="barWidth(m.hovers)"
								></div>
							</div>
						}
					</div>
				} @else {
					<p class="text-sm text-muted-foreground text-center py-4">
						No block tracking data yet. Enable tracking on blocks to see engagement.
					</p>
				}
			</mcms-card-content>
		</mcms-card>
	`,
})
export class BlockAnalyticsWidgetComponent implements OnInit {
	private readonly platformId = inject(PLATFORM_ID);

	readonly loading = signal(false);
	readonly metrics = signal<BlockMetrics[]>([]);

	private readonly maxCount = computed((): number => {
		const all = this.metrics();
		if (all.length === 0) return 1;
		return Math.max(...all.map((m) => m.impressions), 1);
	});

	ngOnInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		void this.fetchBlockMetrics();
	}

	barWidth(count: number): number {
		return Math.max(2, (count / this.maxCount()) * 100);
	}

	private async fetchBlockMetrics(): Promise<void> {
		this.loading.set(true);
		try {
			const [impressionRes, hoverRes] = await Promise.all([
				fetch('/api/analytics/query?name=block_impression&limit=500'),
				fetch('/api/analytics/query?name=block_hover&limit=500'),
			]);

			const impressionEvents = impressionRes.ok
				? parseEventEntries(await impressionRes.json())
				: [];
			const hoverEvents = hoverRes.ok ? parseEventEntries(await hoverRes.json()) : [];

			// Aggregate by blockType
			const impressionMap = new Map<string, number>();
			for (const event of impressionEvents) {
				const bt = String(event.properties['blockType'] ?? 'unknown');
				impressionMap.set(bt, (impressionMap.get(bt) ?? 0) + 1);
			}

			const hoverMap = new Map<string, number>();
			for (const event of hoverEvents) {
				const bt = String(event.properties['blockType'] ?? 'unknown');
				hoverMap.set(bt, (hoverMap.get(bt) ?? 0) + 1);
			}

			// Merge into sorted metrics array
			const allTypes = new Set([...impressionMap.keys(), ...hoverMap.keys()]);
			const result: BlockMetrics[] = [];
			for (const blockType of allTypes) {
				const impressions = impressionMap.get(blockType) ?? 0;
				const hovers = hoverMap.get(blockType) ?? 0;
				const hoverRate = impressions > 0 ? (hovers / impressions) * 100 : 0;
				result.push({ blockType, impressions, hovers, hoverRate });
			}
			result.sort((a, b) => b.impressions - a.impressions);

			this.metrics.set(result);
		} catch {
			// Silently fail — widget is non-critical
		} finally {
			this.loading.set(false);
		}
	}
}

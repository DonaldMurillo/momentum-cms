/**
 * In-Memory Analytics Adapter
 *
 * Stores analytics events in memory. Useful for testing and development.
 */

import type { AnalyticsAdapter } from '../analytics-config.types';
import type {
	AnalyticsEvent,
	AnalyticsQueryOptions,
	AnalyticsQueryResult,
} from '../analytics-event.types';

/**
 * In-memory analytics adapter for development and testing.
 */
export class MemoryAnalyticsAdapter implements AnalyticsAdapter {
	readonly events: AnalyticsEvent[] = [];

	async store(events: AnalyticsEvent[]): Promise<void> {
		this.events.push(...events);
	}

	async query(options: AnalyticsQueryOptions = {}): Promise<AnalyticsQueryResult> {
		let filtered = [...this.events];

		if (options.category) {
			filtered = filtered.filter((e) => e.category === options.category);
		}
		if (options.name) {
			filtered = filtered.filter((e) => e.name === options.name);
		}
		if (options.collection) {
			filtered = filtered.filter((e) => e.context.collection === options.collection);
		}
		if (options.search) {
			const term = options.search.toLowerCase();
			filtered = filtered.filter(
				(e) =>
					e.name.toLowerCase().includes(term) ||
					(e.context.url && e.context.url.toLowerCase().includes(term)) ||
					(e.context.collection && e.context.collection.toLowerCase().includes(term)),
			);
		}
		if (options.from) {
			filtered = filtered.filter((e) => e.timestamp >= options.from!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- guarded above
		}
		if (options.to) {
			filtered = filtered.filter((e) => e.timestamp <= options.to!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- guarded above
		}

		const total = filtered.length;
		const limit = options.limit ?? 50;
		const page = options.page ?? 1;
		const start = (page - 1) * limit;
		const paged = filtered.slice(start, start + limit);

		return { events: paged, total, page, limit };
	}
}

/**
 * Event Store
 *
 * In-memory buffer with periodic flush to the analytics adapter.
 * Events are batched for performance and flushed on interval or batch size.
 */

import type { AnalyticsEvent } from './analytics-event.types';
import type { AnalyticsAdapter } from './analytics-config.types';
import { createLogger, type MomentumLogger } from '@momentum-cms/logger';

/**
 * Options for the event store.
 */
export interface EventStoreOptions {
	/** Storage adapter */
	adapter: AnalyticsAdapter;
	/** Flush interval in ms. @default 5000 */
	flushInterval?: number;
	/** Batch size before forced flush. @default 100 */
	flushBatchSize?: number;
}

/**
 * In-memory event buffer with periodic flush.
 */
export class EventStore {
	private buffer: AnalyticsEvent[] = [];
	private readonly adapter: AnalyticsAdapter;
	private readonly flushInterval: number;
	private readonly flushBatchSize: number;
	private readonly logger: MomentumLogger;
	private timer: ReturnType<typeof setInterval> | null = null;
	private flushing = false;

	constructor(options: EventStoreOptions) {
		this.adapter = options.adapter;
		this.flushInterval = options.flushInterval ?? 5000;
		this.flushBatchSize = options.flushBatchSize ?? 100;
		this.logger = createLogger('Analytics');
	}

	/**
	 * Start the periodic flush timer.
	 */
	start(): void {
		if (this.timer) return;

		this.timer = setInterval(() => {
			void this.flush();
		}, this.flushInterval);
	}

	/**
	 * Add an event to the buffer.
	 * Triggers an immediate flush if batch size is reached.
	 */
	add(event: AnalyticsEvent): void {
		this.buffer.push(event);

		if (this.buffer.length >= this.flushBatchSize) {
			void this.flush();
		}
	}

	/**
	 * Add multiple events to the buffer.
	 */
	addBatch(events: AnalyticsEvent[]): void {
		this.buffer.push(...events);

		if (this.buffer.length >= this.flushBatchSize) {
			void this.flush();
		}
	}

	/**
	 * Flush all buffered events to the adapter.
	 */
	async flush(): Promise<void> {
		if (this.flushing || this.buffer.length === 0) return;

		this.flushing = true;
		const events = this.buffer.splice(0, this.buffer.length);

		try {
			await this.adapter.store(events);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to flush ${events.length} events: ${message}`);
			// Put events back at the front of the buffer
			this.buffer.unshift(...events);
		} finally {
			this.flushing = false;
		}
	}

	/**
	 * Stop the periodic flush timer and flush remaining events.
	 */
	async shutdown(): Promise<void> {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}

		// Flush remaining events
		await this.flush();
	}

	/**
	 * Get the current buffer size.
	 */
	get size(): number {
		return this.buffer.length;
	}
}

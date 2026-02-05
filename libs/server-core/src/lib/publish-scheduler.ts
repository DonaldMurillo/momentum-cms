/**
 * Publish Scheduler
 *
 * Background service that polls for documents scheduled for publishing
 * and publishes them when their scheduled time arrives.
 */

import type { DatabaseAdapter, CollectionConfig } from '@momentum-cms/core';
import { getMomentumAPI } from './momentum-api';

/**
 * Options for the publish scheduler.
 */
export interface PublishSchedulerOptions {
	/** Polling interval in milliseconds (default: 10000 = 10s) */
	intervalMs?: number;

	/** Logger function for status messages */
	logger?: (message: string) => void;
}

/**
 * Publish scheduler instance handle.
 */
export interface PublishSchedulerHandle {
	/** Stop the scheduler */
	stop(): void;

	/** Run one poll cycle manually (for testing) */
	poll(): Promise<number>;
}

/**
 * Start a background scheduler that polls for documents with
 * scheduledPublishAt <= now and publishes them.
 *
 * @param adapter - Database adapter
 * @param collections - All collection configs (only versioned ones are checked)
 * @param options - Scheduler options
 * @returns Handle to stop the scheduler
 */
export function startPublishScheduler(
	adapter: DatabaseAdapter,
	collections: CollectionConfig[],
	options?: PublishSchedulerOptions,
): PublishSchedulerHandle {
	const intervalMs = options?.intervalMs ?? 10000;
	const logger = options?.logger ?? (() => {});

	// Filter to only versioned collections with drafts
	const versionedCollections = collections.filter((c) => {
		const versions = c.versions;
		if (!versions || typeof versions === 'boolean') return false;
		return !!versions.drafts;
	});

	if (versionedCollections.length === 0) {
		logger('[PublishScheduler] No versioned collections found, scheduler not started');
		return {
			stop: () => {},
			poll: async () => 0,
		};
	}

	logger(
		`[PublishScheduler] Started (interval: ${intervalMs}ms, collections: ${versionedCollections.map((c) => c.slug).join(', ')})`,
	);

	/**
	 * Poll for scheduled documents and publish them.
	 * Returns the number of documents published.
	 */
	async function poll(): Promise<number> {
		if (!adapter.findScheduledDocuments) {
			return 0;
		}

		const now = new Date().toISOString();
		let totalPublished = 0;

		for (const collection of versionedCollections) {
			try {
				const scheduled = await adapter.findScheduledDocuments(collection.slug, now);

				for (const doc of scheduled) {
					try {
						const api = getMomentumAPI();
						const versionOps = api.collection(collection.slug).versions();
						if (!versionOps) continue;

						// Publish the document
						await versionOps.publish(doc.id);

						// Clear the scheduled date
						if (adapter.setScheduledPublishAt) {
							await adapter.setScheduledPublishAt(collection.slug, doc.id, null);
						}

						totalPublished++;
						logger(
							`[PublishScheduler] Published ${collection.slug}/${doc.id} (was scheduled for ${doc.scheduledPublishAt})`,
						);
					} catch (err) {
						const message = err instanceof Error ? err.message : 'Unknown error';
						logger(
							`[PublishScheduler] Failed to publish ${collection.slug}/${doc.id}: ${message}`,
						);
					}
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Unknown error';
				logger(
					`[PublishScheduler] Error polling ${collection.slug}: ${message}`,
				);
			}
		}

		return totalPublished;
	}

	const timer = setInterval(() => {
		poll().catch(() => {
			// Errors are logged inside poll(), this catches unexpected rejections
		});
	}, intervalMs);

	return {
		stop: (): void => {
			clearInterval(timer);
			logger('[PublishScheduler] Stopped');
		},
		poll,
	};
}

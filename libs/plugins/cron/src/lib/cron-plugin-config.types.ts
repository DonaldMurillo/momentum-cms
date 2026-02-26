import type { RecurringJobDefinition } from '@momentumcms/core';
import type { QueuePluginInstance } from '@momentumcms/plugins/queue';

/**
 * Cron plugin configuration.
 */
export interface CronPluginConfig {
	/** The queue plugin instance (for enqueuing scheduled jobs) */
	queue: QueuePluginInstance;

	/**
	 * Static recurring job definitions.
	 * These are synced to the database on startup (upsert by name).
	 */
	schedules?: RecurringJobDefinition[];

	/**
	 * How often to check for due schedules (ms).
	 * @default 60000 (1 minute)
	 */
	checkInterval?: number;

	/** Enable admin dashboard route. @default true */
	adminDashboard?: boolean;
}

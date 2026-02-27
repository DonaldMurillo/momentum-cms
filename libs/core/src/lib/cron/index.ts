/**
 * Cron module for Momentum CMS
 * Defines types for recurring job schedules
 */

import type { JobPriority } from '../queue';

/**
 * A recurring job schedule definition.
 * Used by the cron plugin to periodically enqueue jobs into the queue.
 */
export interface RecurringJobDefinition {
	/** Unique name for this recurring schedule */
	name: string;
	/** Job type to enqueue (must match a registered handler in the queue plugin) */
	type: string;
	/** Cron expression (5-field: minute hour day-of-month month day-of-week) */
	cron: string;
	/** Job payload */
	payload?: unknown;
	/** Queue name. @default 'default' */
	queue?: string;
	/** Priority (0=highest, 9=lowest). @default 5 */
	priority?: JobPriority;
	/** Maximum retry attempts. @default 3 */
	maxRetries?: number;
	/** Timeout in ms. @default 30000 */
	timeout?: number;
	/** Whether the schedule is enabled. @default true */
	enabled?: boolean;
}

import type {
	JobPriority,
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
	RecurringJobDefinition,
} from '@momentumcms/core';
import { getNextCronDate, isValidCronExpression } from '@momentumcms/queue';
import type { CronPluginConfig } from './cron-plugin-config.types';
import { CronSchedulesCollection } from './cron-schedules.collection';
import { cronAdminRoutes } from './cron-admin-routes';

const VALID_PRIORITIES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

function isJobPriority(val: unknown): val is JobPriority {
	return typeof val === 'number' && VALID_PRIORITIES.has(val);
}

function toJobPriority(val: unknown): JobPriority {
	if (isJobPriority(val)) return val;
	return 5;
}

/**
 * Extended plugin interface exposing cron schedule management.
 */
export interface CronPluginInstance extends MomentumPlugin {
	/** Add or update a recurring schedule. */
	addSchedule(definition: RecurringJobDefinition): Promise<void>;
	/** Remove a recurring schedule by name. */
	removeSchedule(name: string): Promise<void>;
	/** List all recurring schedules. */
	getSchedules(): Promise<RecurringJobDefinition[]>;
}

interface ScheduleRecord {
	id: string;
	name: string;
	type: string;
	cron: string;
	payload?: unknown;
	queue?: string;
	priority?: number;
	maxRetries?: number;
	timeout?: number;
	enabled?: boolean;
	lastRunAt?: string;
	nextRunAt?: string;
}

/**
 * Create the cron plugin.
 *
 * @param config - Cron plugin configuration
 * @returns CronPluginInstance
 *
 * @example
 * ```typescript
 * import { cronPlugin } from '@momentumcms/plugins/cron';
 *
 * export const cron = cronPlugin({
 *   queue,
 *   schedules: [
 *     { name: 'daily-cleanup', type: 'maintenance:cleanup', cron: '0 2 * * *' },
 *   ],
 * });
 * ```
 */
export function cronPlugin(config: CronPluginConfig): CronPluginInstance {
	let checkTimer: ReturnType<typeof setInterval> | null = null;
	let shuttingDown = false;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MomentumAPI.collection returns unknown
	let cronCollection: any = null;

	const instance: CronPluginInstance = {
		name: 'cron',

		collections: [CronSchedulesCollection],

		adminRoutes: config.adminDashboard !== false ? cronAdminRoutes : [],

		browserImports: {
			adminRoutes: {
				path: '@momentumcms/plugins-cron/admin-routes',
				exportName: 'cronAdminRoutes',
			},
		},

		async addSchedule(definition: RecurringJobDefinition): Promise<void> {
			if (!cronCollection) {
				throw new Error('Cron plugin not ready yet');
			}
			if (!isValidCronExpression(definition.cron)) {
				throw new Error(`Invalid cron expression: ${definition.cron}`);
			}

			const nextRunAt = getNextCronDate(definition.cron).toISOString();

			// Try to find existing schedule by name
			const existing = await cronCollection.find({
				where: { name: { equals: definition.name } },
				limit: 1,
			});

			if (existing.docs?.length > 0) {
				await cronCollection.update(existing.docs[0].id, {
					type: definition.type,
					cron: definition.cron,
					payload: definition.payload ?? null,
					queue: definition.queue ?? 'default',
					priority: definition.priority ?? 5,
					maxRetries: definition.maxRetries ?? 3,
					timeout: definition.timeout ?? 30000,
					enabled: definition.enabled ?? true,
					nextRunAt,
				});
			} else {
				await cronCollection.create({
					name: definition.name,
					type: definition.type,
					cron: definition.cron,
					payload: definition.payload ?? null,
					queue: definition.queue ?? 'default',
					priority: definition.priority ?? 5,
					maxRetries: definition.maxRetries ?? 3,
					timeout: definition.timeout ?? 30000,
					enabled: definition.enabled ?? true,
					nextRunAt,
				});
			}
		},

		async removeSchedule(name: string): Promise<void> {
			if (!cronCollection) {
				throw new Error('Cron plugin not ready yet');
			}
			const existing = await cronCollection.find({
				where: { name: { equals: name } },
				limit: 1,
			});
			if (existing.docs?.length > 0) {
				await cronCollection.delete(existing.docs[0].id);
			}
		},

		async getSchedules(): Promise<RecurringJobDefinition[]> {
			if (!cronCollection) {
				throw new Error('Cron plugin not ready yet');
			}
			const result = await cronCollection.find({ limit: 1000 });
			return (result.docs ?? []).map((doc: ScheduleRecord) => ({
				name: doc.name,
				type: doc.type,
				cron: doc.cron,
				payload: doc.payload,
				queue: doc.queue,
				priority: doc.priority,
				maxRetries: doc.maxRetries,
				timeout: doc.timeout,
				enabled: doc.enabled,
			}));
		},

		async onInit({ collections, logger }: PluginContext): Promise<void> {
			// Push collection (idempotency guard)
			if (!collections.some((c) => c.slug === 'cron-schedules')) {
				collections.push(CronSchedulesCollection);
			}
			logger.info('Cron plugin initialized');
		},

		async onReady({ api, logger }: PluginReadyContext): Promise<void> {
			cronCollection = api.collection('cron-schedules');

			// Sync static schedules to database
			for (const schedule of config.schedules ?? []) {
				if (!isValidCronExpression(schedule.cron)) {
					logger.error(`Invalid cron expression for "${schedule.name}": ${schedule.cron}`);
					continue;
				}

				try {
					// Use the plugin's own addSchedule which does upsert
					await instance.addSchedule(schedule);
					logger.info(`Registered cron schedule: ${schedule.name} (${schedule.cron})`);
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					logger.error(`Failed to register cron schedule "${schedule.name}": ${msg}`);
				}
			}

			// Start scheduler check loop
			const checkInterval = config.checkInterval ?? 60000;
			checkTimer = setInterval((): void => {
				if (shuttingDown) return;
				void checkDueSchedules(logger);
			}, checkInterval);

			logger.info(`Cron scheduler started (check interval: ${checkInterval}ms)`);
		},

		async onShutdown({ logger }: PluginContext): Promise<void> {
			shuttingDown = true;
			if (checkTimer) clearInterval(checkTimer);
			logger.info('Cron plugin shut down');
		},
	};

	return instance;

	async function checkDueSchedules(logger: {
		info: (msg: string) => void;
		error: (msg: string) => void;
	}): Promise<void> {
		if (!cronCollection) return;

		try {
			const now = new Date().toISOString();
			const result = await cronCollection.find({
				where: {
					and: [{ enabled: { equals: true } }, { nextRunAt: { less_than_equal: now } }],
				},
				limit: 100,
			});

			const docs: ScheduleRecord[] = result.docs ?? [];
			for (const schedule of docs) {
				try {
					// Defense in depth: optimistic lock reduces unnecessary DB writes,
					// while uniqueKey on enqueue() provides atomic deduplication at the DB level.
					const freshDoc: ScheduleRecord = await cronCollection.findById(schedule.id);
					if (freshDoc.nextRunAt !== schedule.nextRunAt) {
						continue; // Another instance already processed this
					}

					// Advance nextRunAt FIRST to prevent stuck schedules.
					// If enqueue fails after this, the schedule still advances
					// (missed tick is safer than duplicate execution).
					const oldNextRunAt = schedule.nextRunAt;
					const nextRunAt = getNextCronDate(schedule.cron).toISOString();
					await cronCollection.update(schedule.id, {
						lastRunAt: now,
						nextRunAt,
					});

					// Enqueue the job with uniqueKey based on the OLD nextRunAt
					// to atomically prevent duplicate cron jobs across instances
					try {
						await config.queue.enqueue(schedule.type, schedule.payload ?? {}, {
							queue: schedule.queue ?? 'default',
							priority: toJobPriority(schedule.priority ?? 5),
							maxRetries: schedule.maxRetries ?? 3,
							timeout: schedule.timeout ?? 30000,
							uniqueKey: `cron:${schedule.name}:${oldNextRunAt}`,
						});
					} catch (enqueueErr: unknown) {
						const enqMsg = enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr);
						logger.error(
							`Failed to enqueue cron job "${schedule.name}": ${enqMsg} (schedule advanced, will retry on next occurrence)`,
						);
						continue;
					}

					logger.info(`Enqueued cron job: ${schedule.name} (${schedule.type})`);
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					logger.error(`Failed to process cron schedule "${schedule.name}": ${msg}`);
				}
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`Cron schedule check failed: ${msg}`);
		}
	}
}

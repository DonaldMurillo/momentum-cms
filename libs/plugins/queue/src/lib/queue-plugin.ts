import type {
	EnqueueOptions,
	Job,
	MomentumPlugin,
	PluginContext,
	PluginReadyContext,
	QueueAdapter,
} from '@momentumcms/core';
import type { JobHandler, QueuePluginConfig } from './queue-plugin-config.types';
import { QueueWorker } from './queue-worker';
import { QueueJobsCollection } from './queue-jobs.collection';
import { createQueueAdminRouter } from './queue-admin-router';
import { queueAdminRoutes } from './queue-admin-routes';

/**
 * Extended plugin interface exposing the queue adapter and enqueue convenience method.
 */
export interface QueuePluginInstance extends MomentumPlugin {
	/** The queue adapter for direct access */
	readonly adapter: QueueAdapter;
	/** Register a job handler at runtime */
	registerHandler(type: string, handler: JobHandler): void;
	/** Convenience: enqueue a job */
	enqueue(type: string, payload: unknown, options?: EnqueueOptions): Promise<Job>;
}

/**
 * Create the queue plugin.
 *
 * @param config - Queue plugin configuration
 * @returns QueuePluginInstance
 *
 * @example
 * ```typescript
 * import { postgresQueueAdapter } from '@momentumcms/queue';
 * import { queuePlugin } from '@momentumcms/plugins/queue';
 *
 * export const queue = queuePlugin({
 *   adapter: postgresQueueAdapter({ pool }),
 *   handlers: {
 *     'email:send': async (payload, job, { logger }) => {
 *       logger.info(`Sending email to ${payload.to}`);
 *     },
 *   },
 *   workers: { default: { concurrency: 2 } },
 * });
 * ```
 */
export function queuePlugin(config: QueuePluginConfig): QueuePluginInstance {
	const handlers = new Map<string, JobHandler>(Object.entries(config.handlers ?? {}));
	const workers: QueueWorker[] = [];
	let stalledTimer: ReturnType<typeof setInterval> | null = null;
	let purgeTimer: ReturnType<typeof setInterval> | null = null;
	let shuttingDown = false;

	return {
		name: 'queue',
		adapter: config.adapter,

		collections: [QueueJobsCollection],

		adminRoutes: config.adminDashboard !== false ? queueAdminRoutes : [],

		browserImports: {
			adminRoutes: {
				path: '@momentumcms/plugins-queue/admin-routes',
				exportName: 'queueAdminRoutes',
			},
		},

		registerHandler(type: string, handler: JobHandler): void {
			handlers.set(type, handler);
		},

		async enqueue(type: string, payload: unknown, options?: EnqueueOptions): Promise<Job> {
			return config.adapter.enqueue(type, payload, options);
		},

		async onInit({ collections, logger, registerMiddleware }: PluginContext): Promise<void> {
			// Push collection (idempotency guard)
			if (!collections.some((c) => c.slug === 'queue-jobs')) {
				collections.push(QueueJobsCollection);
			}

			// Initialize adapter (creates partial indexes, etc.)
			await config.adapter.initialize();
			logger.info('Queue adapter initialized');

			// Register admin API endpoints
			if (config.adminDashboard !== false) {
				const adminRouter = createQueueAdminRouter({ adapter: config.adapter, logger });
				registerMiddleware({
					path: '/queue',
					handler: adminRouter,
					position: 'before-api',
				});
				logger.info('Queue admin API endpoints registered');
			}
		},

		async onReady({ api, logger }: PluginReadyContext): Promise<void> {
			// Start workers for each configured queue
			const workerConfigs = config.workers ?? { default: {} };
			for (const [queueName, workerConfig] of Object.entries(workerConfigs)) {
				if (workerConfig.enabled === false) continue;

				const concurrency = workerConfig.concurrency ?? 1;
				const pollInterval = workerConfig.pollInterval ?? 1000;

				const worker = new QueueWorker({
					adapter: config.adapter,
					queue: queueName,
					concurrency,
					pollInterval,
					handlers,
					api,
					logger,
				});
				worker.start();
				workers.push(worker);
				logger.info(`Worker started for queue "${queueName}" (concurrency: ${concurrency})`);
			}

			// Start stalled job recovery
			const stalledInterval = config.stalledCheckInterval ?? 30000;
			stalledTimer = setInterval((): void => {
				if (shuttingDown) return;
				config.adapter
					.recoverStalledJobs()
					.then((count) => {
						if (count > 0) logger.info(`Recovered ${count} stalled job(s)`);
					})
					.catch((err: unknown) => {
						const msg = err instanceof Error ? err.message : String(err);
						logger.error(`Stalled job recovery failed: ${msg}`);
					});
			}, stalledInterval);

			// Start job purge
			const purgeInterval = config.purgeInterval ?? 3600000;
			if (purgeInterval > 0) {
				const purgeAge = config.purgeAge ?? 604800000; // 7 days
				purgeTimer = setInterval((): void => {
					if (shuttingDown) return;
					Promise.all([
						config.adapter.purgeJobs(purgeAge, 'completed'),
						config.adapter.purgeJobs(purgeAge, 'dead'),
					])
						.then(([completed, dead]) => {
							if (completed + dead > 0) {
								logger.info(`Purged ${completed} completed, ${dead} dead jobs`);
							}
						})
						.catch((err: unknown) => {
							const msg = err instanceof Error ? err.message : String(err);
							logger.error(`Job purge failed: ${msg}`);
						});
				}, purgeInterval);
			}

			logger.info('Queue plugin ready');
		},

		async onShutdown({ logger }: PluginContext): Promise<void> {
			shuttingDown = true;
			logger.info('Shutting down queue workers...');

			// Stop all timers
			if (stalledTimer) clearInterval(stalledTimer);
			if (purgeTimer) clearInterval(purgeTimer);

			// Gracefully stop workers (finish in-flight jobs, stop polling)
			await Promise.all(workers.map((w) => w.stop()));

			// Shutdown adapter
			await config.adapter.shutdown();

			logger.info('Queue plugin shut down');
		},
	};
}

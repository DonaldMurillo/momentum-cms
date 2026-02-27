// Queue plugin
export { queuePlugin } from './lib/queue-plugin';
export type { QueuePluginInstance } from './lib/queue-plugin';

// Config types
export type {
	QueuePluginConfig,
	JobHandler,
	JobHandlerContext,
	WorkerConfig,
} from './lib/queue-plugin-config.types';

// Collection
export { QueueJobsCollection } from './lib/queue-jobs.collection';

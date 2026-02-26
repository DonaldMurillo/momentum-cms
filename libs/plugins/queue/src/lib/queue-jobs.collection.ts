import { defineCollection, text, number, select, json, date } from '@momentumcms/core';

/**
 * Queue jobs collection.
 * Stores all job records for the queue system.
 *
 * Schema creation and timestamps are handled by the collection system.
 * The queue adapter uses raw SQL (SKIP LOCKED) for the hot path.
 */
export const QueueJobsCollection = defineCollection({
	slug: 'queue-jobs',
	labels: { singular: 'Job', plural: 'Jobs' },
	admin: {
		group: 'System',
		useAsTitle: 'type',
		defaultColumns: ['type', 'status', 'queue', 'priority', 'attempts', 'createdAt'],
		pagination: { defaultLimit: 50 },
	},
	fields: [
		text('type', { required: true, label: 'Job Type' }),
		json('payload', { label: 'Payload' }),
		select('status', {
			required: true,
			defaultValue: 'pending',
			label: 'Status',
			options: [
				{ label: 'Pending', value: 'pending' },
				{ label: 'Active', value: 'active' },
				{ label: 'Completed', value: 'completed' },
				{ label: 'Failed', value: 'failed' },
				{ label: 'Dead', value: 'dead' },
			],
		}),
		text('queue', { required: true, defaultValue: 'default', label: 'Queue' }),
		number('priority', {
			required: true,
			defaultValue: 5,
			min: 0,
			max: 9,
			label: 'Priority',
			description: '0 = highest, 9 = lowest',
		}),
		number('attempts', { required: true, defaultValue: 0, label: 'Attempts' }),
		number('maxRetries', { required: true, defaultValue: 3, label: 'Max Retries' }),
		json('backoff', {
			defaultValue: { type: 'exponential', delay: 1000 },
			label: 'Backoff Strategy',
		}),
		number('timeout', {
			required: true,
			defaultValue: 30000,
			label: 'Timeout (ms)',
		}),
		text('uniqueKey', { label: 'Unique Key' }),
		date('runAt', { label: 'Run At' }),
		date('startedAt', { label: 'Started At' }),
		date('finishedAt', { label: 'Finished At' }),
		text('lastError', { label: 'Last Error' }),
		json('metadata', { label: 'Metadata' }),
	],
	indexes: [
		{
			columns: ['queue', 'status', 'priority', 'runAt', 'createdAt'],
			name: 'idx_queue_jobs_fetch',
		},
		{
			columns: ['status', 'startedAt'],
			name: 'idx_queue_jobs_active',
		},
		{
			columns: ['status', 'finishedAt'],
			name: 'idx_queue_jobs_finished',
		},
	],
	access: {
		read: ({ req }) => req.user?.['role'] === 'admin',
		create: () => false, // Jobs are created via the adapter, not the API
		update: () => false, // Jobs are updated via the adapter, not the API
		delete: ({ req }) => req.user?.['role'] === 'admin',
	},
});

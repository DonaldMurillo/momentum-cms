import { defineCollection, text, number, json, date, checkbox } from '@momentumcms/core';

/**
 * Cron schedules collection.
 * Stores recurring job schedule definitions.
 */
export const CronSchedulesCollection = defineCollection({
	slug: 'cron-schedules',
	labels: { singular: 'Cron Schedule', plural: 'Cron Schedules' },
	admin: {
		group: 'System',
		useAsTitle: 'name',
		defaultColumns: ['name', 'type', 'cron', 'enabled', 'lastRunAt', 'nextRunAt'],
	},
	fields: [
		text('name', { required: true, unique: true, label: 'Schedule Name' }),
		text('type', { required: true, label: 'Job Type' }),
		text('cron', {
			required: true,
			label: 'Cron Expression',
			description: '5-field cron: minute hour day-of-month month day-of-week',
		}),
		json('payload', { label: 'Job Payload' }),
		text('queue', { defaultValue: 'default', label: 'Queue' }),
		number('priority', {
			defaultValue: 5,
			min: 0,
			max: 9,
			label: 'Priority',
			description: '0 = highest, 9 = lowest',
		}),
		number('maxRetries', { defaultValue: 3, label: 'Max Retries' }),
		number('timeout', { defaultValue: 30000, label: 'Timeout (ms)' }),
		checkbox('enabled', { defaultValue: true, label: 'Enabled' }),
		date('lastRunAt', { label: 'Last Run At' }),
		date('nextRunAt', { label: 'Next Run At' }),
	],
	indexes: [
		{ columns: ['name'], unique: true },
		{ columns: ['enabled', 'nextRunAt'], name: 'idx_cron_due' },
	],
	access: {
		read: ({ req }) => req.user?.['role'] === 'admin',
		create: ({ req }) => req.user?.['role'] === 'admin',
		update: ({ req }) => req.user?.['role'] === 'admin',
		delete: ({ req }) => req.user?.['role'] === 'admin',
	},
});

import { defineCollection, text, textarea, date, blocks, allowAll } from '@momentumcms/core';

/**
 * Events collection for E2E testing.
 * Has preview enabled for live preview tests.
 * Includes a standard blocks field (no visual editor) for collapse/expand E2E tests.
 */
export const Events = defineCollection({
	slug: 'events',
	labels: {
		singular: 'Event',
		plural: 'Events',
	},
	fields: [
		text('title', { required: true, label: 'Title' }),
		textarea('description', { label: 'Description' }),
		text('location', { label: 'Location' }),
		date('eventDate', { label: 'Event Date' }),
		blocks('sections', {
			label: 'Event Sections',
			blocks: [
				{
					slug: 'speaker',
					labels: { singular: 'Speaker', plural: 'Speakers' },
					fields: [
						text('name', { required: true, label: 'Speaker Name' }),
						text('topic', { label: 'Talk Topic' }),
					],
				},
				{
					slug: 'schedule',
					labels: { singular: 'Schedule', plural: 'Schedules' },
					fields: [
						text('time', { required: true, label: 'Time' }),
						text('activity', { required: true, label: 'Activity' }),
					],
				},
			],
		}),
	],
	admin: {
		useAsTitle: 'title',
		preview: true,
	},
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
	},
});

import { defineCollection, text, textarea, date, allowAll } from '@momentum-cms/core';

/**
 * Events collection for E2E testing.
 * Has preview enabled for live preview tests.
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

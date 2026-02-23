import { defineCollection, text, select, checkbox } from '@momentumcms/core';

export const RedirectsCollection = defineCollection({
	slug: 'redirects',
	labels: {
		singular: 'Redirect',
		plural: 'Redirects',
	},
	fields: [
		text('from', { required: true, label: 'From Path' }),
		text('to', { required: true, label: 'To Path / URL' }),
		select('type', {
			label: 'Status Code',
			options: [
				{ label: '301 — Permanent', value: 'permanent' },
				{ label: '302 — Temporary', value: 'temporary' },
				{ label: '307 — Temporary (Preserve Method)', value: 'temporary_preserve' },
				{ label: '308 — Permanent (Preserve Method)', value: 'permanent_preserve' },
			],
			defaultValue: 'permanent',
		}),
		checkbox('active', { label: 'Active', defaultValue: true }),
	],
	indexes: [{ columns: ['from'], unique: true }],
	access: {
		read: () => true,
		create: ({ req }) => req?.user?.role === 'admin',
		update: ({ req }) => req?.user?.role === 'admin',
		delete: ({ req }) => req?.user?.role === 'admin',
	},
	admin: {
		useAsTitle: 'from',
		group: 'Settings',
	},
});

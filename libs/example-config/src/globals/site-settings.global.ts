import { defineGlobal, text, textarea, checkbox } from '@momentumcms/core';

export const SiteSettings = defineGlobal({
	slug: 'site-settings',
	label: 'Site Settings',
	fields: [
		text('site-name', { required: true, label: 'Site Name' }),
		textarea('description', { label: 'Site Description' }),
		checkbox('maintenance-mode', { label: 'Maintenance Mode' }),
	],
	access: {
		read: () => true,
		update: ({ req }) => req.user?.role === 'admin',
	},
});

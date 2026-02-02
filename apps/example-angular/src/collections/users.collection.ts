import { defineCollection, text, email, checkbox, select } from '@momentum-cms/core';

export const Users = defineCollection({
	slug: 'users',
	labels: {
		singular: 'User',
		plural: 'Users',
	},
	fields: [
		text('name', { required: true, label: 'Name' }),
		email('email', { required: true, label: 'Email' }),
		select('role', {
			label: 'Role',
			required: true,
			options: [
				{ label: 'Admin', value: 'admin' },
				{ label: 'Editor', value: 'editor' },
				{ label: 'Viewer', value: 'viewer' },
			],
		}),
		checkbox('active', { label: 'Active' }),
	],
});

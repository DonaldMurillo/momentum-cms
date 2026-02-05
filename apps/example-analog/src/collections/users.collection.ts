import { defineCollection, text, email, checkbox, select, hasRole } from '@momentum-cms/core';

export const Users = defineCollection({
	slug: 'users',
	labels: {
		singular: 'User',
		plural: 'Users',
	},
	fields: [
		text('name', { required: true, label: 'Name' }),
		email('email', { required: true, label: 'Email' }),
		text('authId', { label: 'Auth ID' }),
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
	hooks: {
		beforeChange: [
			({ data, operation }) => {
				if (operation === 'create' && data && 'password' in data) {
					const { password: _password, ...rest } = data;
					return rest;
				}
				return data ?? {};
			},
		],
	},
	access: {
		read: hasRole('admin'),
		create: hasRole('admin'),
		update: hasRole('admin'),
		delete: hasRole('admin'),
		admin: hasRole('admin'),
	},
});

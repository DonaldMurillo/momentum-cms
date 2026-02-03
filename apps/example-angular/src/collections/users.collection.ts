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
		text('authId', { label: 'Auth ID' }), // Links to Better Auth user.id
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
		// Simple hook to strip password field before database insert
		// The user sync hook in server.ts handles Better Auth user creation
		beforeChange: [
			({ data, operation }) => {
				if (operation === 'create' && data && 'password' in data) {
					// eslint-disable-next-line no-console
					console.log('[UsersCollection] beforeChange: Stripping password from data');
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { password, ...rest } = data;
					return rest;
				}
				return data ?? {};
			},
		],
	},
	access: {
		// Only admins can manage users
		read: hasRole('admin'),
		create: hasRole('admin'),
		update: hasRole('admin'),
		delete: hasRole('admin'),
		admin: hasRole('admin'),
	},
});

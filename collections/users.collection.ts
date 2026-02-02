/**
 * Users Collection
 * Authentication-enabled collection for user management
 */

import {
	defineCollection,
	text,
	email,
	password,
	select,
	checkbox,
	date,
} from '@momentum-cms/core';

export const Users = defineCollection({
	slug: 'users',

	labels: {
		singular: 'User',
		plural: 'Users',
	},

	auth: true, // Enable authentication

	admin: {
		useAsTitle: 'email',
		defaultColumns: ['email', 'role', 'createdAt'],
		group: 'Admin',
	},

	access: {
		// Anyone can read user profiles
		read: () => true,

		// Only authenticated users can create new users
		create: ({ req }) => !!req.user,

		// Users can update their own profile, admins can update anyone
		update: ({ req, id }) => {
			if (!req.user) return false;
			if (req.user.role === 'admin') return true;
			return req.user.id === id;
		},

		// Only admins can delete users
		delete: ({ req }) => req.user?.role === 'admin',

		// Only admins can access admin panel
		admin: ({ req }) => req.user?.role === 'admin',
	},

	hooks: {
		beforeChange: [
			({ data, operation }) => {
				// Set default role for new users
				if (operation === 'create' && !data.role) {
					data.role = 'user';
				}
				return data;
			},
		],
	},

	fields: [
		email('email', {
			required: true,
			unique: true,
			label: 'Email Address',
		}),

		password('password', {
			required: true,
			minLength: 8,
			label: 'Password',
		}),

		text('firstName', {
			label: 'First Name',
		}),

		text('lastName', {
			label: 'Last Name',
		}),

		select('role', {
			required: true,
			defaultValue: 'user',
			options: [
				{ label: 'User', value: 'user' },
				{ label: 'Editor', value: 'editor' },
				{ label: 'Admin', value: 'admin' },
			],
			label: 'Role',
			admin: {
				position: 'sidebar',
			},
		}),

		checkbox('emailVerified', {
			defaultValue: false,
			label: 'Email Verified',
			admin: {
				position: 'sidebar',
				readOnly: true,
			},
		}),

		date('lastLogin', {
			label: 'Last Login',
			admin: {
				position: 'sidebar',
				readOnly: true,
			},
		}),
	],
});

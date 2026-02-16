import { defineCollection, text } from '@momentumcms/core';

/**
 * Test collection for validating defaultWhere enforcement on mutations.
 *
 * Non-admin users are scoped to their own notes via defaultWhere.
 * All authenticated users can CRUD, so defaultWhere is the only row-level
 * restriction — making this ideal for E2E tests that prove update/delete
 * respect the constraint.
 */
export const UserNotes = defineCollection({
	slug: 'user-notes',
	labels: { singular: 'User Note', plural: 'User Notes' },
	fields: [text('title', { required: true }), text('ownerId', { admin: { hidden: true } })],
	hooks: {
		beforeChange: [
			({ data, operation, req }) => {
				if (operation === 'create' && data) {
					return { ...data, ownerId: req.user?.id ?? '' };
				}
				return undefined;
			},
		],
	},
	defaultWhere: (req) => {
		if (!req.user) return { ownerId: '__none__' };
		if (req.user.role === 'admin') return undefined;
		return { ownerId: req.user.id };
	},
	access: {
		read: ({ req }) => !!req.user,
		create: ({ req }) => !!req.user,
		update: ({ req }) => !!req.user,
		delete: ({ req }) => !!req.user,
		admin: ({ req }) => !!req.user,
	},
});

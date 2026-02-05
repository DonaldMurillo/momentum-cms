import { defineCollection, text, allowAll } from '@momentum-cms/core';

/**
 * Simple collection for seeding E2E tests.
 * Used to test basic seeding, relationships, and custom endpoints.
 */
/** Webhook receiver URL (same server for E2E testing). */
const webhookReceiverUrl =
	(typeof process !== 'undefined' ? process.env?.['WEBHOOK_RECEIVER_URL'] : undefined) ??
	'http://localhost:4001/api/test-webhook-receiver';

export const Categories = defineCollection({
	slug: 'categories',
	labels: {
		singular: 'Category',
		plural: 'Categories',
	},
	fields: [
		text('name', { required: true, label: 'Name' }),
		text('slug', { required: true, label: 'Slug' }),
	],
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
	},
	webhooks: [
		{
			url: webhookReceiverUrl,
			events: ['afterCreate', 'afterUpdate', 'afterDelete'],
			secret: 'test-webhook-secret',
		},
	],
	endpoints: [
		{
			path: 'count',
			method: 'get',
			handler: async ({ query }) => {
				// Use find + docs.length since count() has a known pagination bug
				const result = await query.find('categories', { limit: 1000 });
				return { status: 200, body: { count: result.docs.length } };
			},
		},
		{
			path: 'slugs',
			method: 'get',
			handler: async ({ query }) => {
				const result = await query.find('categories', { limit: 100 });
				const slugs = result.docs.map((d) => d['slug']);
				return { status: 200, body: { slugs } };
			},
		},
		{
			path: 'test-transaction-rollback',
			method: 'post',
			handler: async ({ query }) => {
				try {
					await query.transaction(async (txQuery) => {
						// Create a category inside the transaction
						await txQuery.create('categories', {
							name: 'TX Rollback Test',
							slug: 'tx-rollback-test',
						});
						// Intentionally throw to trigger rollback
						throw new Error('Intentional rollback');
					});
				} catch (error) {
					const msg = error instanceof Error ? error.message : 'unknown';
					return { status: 200, body: { rolledBack: true, error: msg } };
				}
				return { status: 200, body: { rolledBack: false } };
			},
		},
		{
			path: 'test-transaction-success',
			method: 'post',
			handler: async ({ query }) => {
				const result = await query.transaction(async (txQuery) => {
					const cat1 = await txQuery.create('categories', {
						name: 'TX Success A',
						slug: 'tx-success-a',
					});
					const cat2 = await txQuery.create('categories', {
						name: 'TX Success B',
						slug: 'tx-success-b',
					});
					return { ids: [cat1['id'], cat2['id']] };
				});
				return { status: 200, body: result };
			},
		},
	],
});

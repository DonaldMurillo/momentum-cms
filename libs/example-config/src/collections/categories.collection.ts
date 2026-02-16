import { defineCollection, text, allowAll } from '@momentumcms/core';

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
	admin: { group: 'Content' },
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
		/* eslint-disable @typescript-eslint/consistent-type-assertions -- Test endpoint body/query access */
		{
			path: 'custom-create',
			method: 'post',
			handler: async ({ body, query }) => {
				if (!body || !body['name'] || !body['slug']) {
					return { status: 400, body: { error: 'name and slug are required' } };
				}
				const doc = await query.create('categories', {
					name: body['name'] as string,
					slug: body['slug'] as string,
				});
				return { status: 201, body: { doc } };
			},
		},
		{
			path: 'custom-update',
			method: 'put',
			handler: async ({ body, query }) => {
				if (!body || !body['id'] || !body['name']) {
					return { status: 400, body: { error: 'id and name are required' } };
				}
				const doc = await query.update('categories', body['id'] as string, {
					name: body['name'] as string,
				});
				return { status: 200, body: { doc } };
			},
		},
		{
			path: 'delete-by-slug',
			method: 'post',
			handler: async ({ body, query }) => {
				if (!body || !body['slug']) {
					return { status: 400, body: { error: 'slug is required' } };
				}
				const result = await query.find('categories', { limit: 1000 });
				const doc = result.docs.find((d) => d['slug'] === body['slug']);
				if (!doc) {
					return { status: 404, body: { error: 'Category not found' } };
				}
				await query.delete('categories', doc['id'] as string);
				return { status: 200, body: { deleted: true, slug: body['slug'] } };
			},
		},
		{
			path: 'articles-by-slug',
			method: 'get',
			handler: async ({ query }) => {
				const catResult = await query.find('categories', { limit: 1000 });
				const artResult = await query.find('articles', { limit: 1000 });
				const articlesByCategory: Record<string, string[]> = {};
				for (const cat of catResult.docs) {
					const catId = cat['id'] as string;
					const catSlug = cat['slug'] as string;
					const titles = artResult.docs
						.filter((a) => a['category'] === catId)
						.map((a) => a['title'] as string);
					if (titles.length > 0) {
						articlesByCategory[catSlug] = titles;
					}
				}
				return { status: 200, body: { articlesByCategory } };
			},
		},
		{
			path: 'error-test',
			method: 'get',
			handler: async () => {
				throw new Error('Intentional endpoint error');
			},
		},
		{
			path: 'sequential-ops',
			method: 'post',
			handler: async ({ body, query }) => {
				const name = (body?.['name'] as string) ?? 'Sequential Test';
				const slug = (body?.['slug'] as string) ?? 'sequential-test';
				const created = await query.create('categories', { name, slug });
				const updated = await query.update('categories', created['id'] as string, {
					name: `${created['name'] as string} (Updated)`,
				});
				const readBack = await query.findById('categories', updated['id'] as string);
				return { status: 200, body: { created, updated, readBack } };
			},
		},
		/* eslint-enable @typescript-eslint/consistent-type-assertions */
	],
});

/**
 * OTel Snapshots Collection
 *
 * Internal collection for persisting periodic metric snapshots.
 * Injected into the collections array by the otel plugin during onInit.
 */

import { defineCollection, number, json, hasRole } from '@momentumcms/core';

export const OtelSnapshotsCollection = defineCollection({
	slug: 'otel-snapshots',
	labels: {
		singular: 'OTel Snapshot',
		plural: 'OTel Snapshots',
	},
	admin: {
		hidden: true,
	},
	timestamps: true,
	fields: [
		number('totalRequests', { required: true }),
		number('errorCount', { required: true }),
		number('avgDurationMs', { required: true }),
		number('memoryUsageMb', { required: true }),
		json('byMethod', {}),
		json('byStatusCode', {}),
		json('collectionMetrics', {}),
		json('topSpans', {}),
	],
	access: {
		read: hasRole('admin'),
		create: hasRole('admin'),
		update: hasRole('admin'),
		delete: hasRole('admin'),
		admin: () => false,
	},
});

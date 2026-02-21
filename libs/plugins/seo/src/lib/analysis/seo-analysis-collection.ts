/**
 * SEO Analysis Collection
 *
 * Stores SEO analysis results per document.
 * Hidden from sidebar — accessed via SEO dashboard.
 */

import { defineCollection, text, number, json, date, hasRole } from '@momentumcms/core';
import type { AccessArgs } from '@momentumcms/core';

/**
 * Allow internal server-side calls (no user context) or admin users.
 * Plugin hooks run without user context, so we must allow access
 * when there is no user attached to the request.
 *
 * Safe because the collection is `managed: true` — no auto-generated
 * REST routes exist, so unauthenticated HTTP requests cannot reach
 * these access functions. The dashboard exposes a read-only endpoint
 * with its own admin auth guard.
 */
function internalOrAdmin({ req }: AccessArgs): boolean {
	if (!req.user) return true;
	return req.user.role === 'admin';
}

export const SeoAnalysis = defineCollection({
	slug: 'seo-analysis',
	managed: true,
	labels: { singular: 'SEO Analysis', plural: 'SEO Analyses' },
	admin: {
		group: 'SEO',
		hidden: true,
		useAsTitle: 'documentId',
	},
	fields: [
		text('collection', { required: true, label: 'Collection' }),
		text('documentId', { required: true, label: 'Document ID' }),
		number('score', { required: true, label: 'Score', min: 0, max: 100 }),
		text('grade', { required: true, label: 'Grade' }),
		json('rules', { label: 'Rule Results' }),
		text('focusKeyword', { label: 'Focus Keyword' }),
		date('analyzedAt', { required: true, label: 'Analyzed At' }),
	],
	access: {
		read: internalOrAdmin,
		create: internalOrAdmin,
		update: internalOrAdmin,
		delete: hasRole('admin'),
	},
});

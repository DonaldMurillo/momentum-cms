import type { ResolveFn } from '@angular/router';
import { injectMomentumAPI, type FindResult } from '@momentumcms/admin';

/**
 * Resolver for the article detail route.
 *
 * Fetches the article by slug before the component renders. This ensures:
 * - SSR renders the full article content (not just "Loading...")
 * - The admin preview iframe (with scripts disabled) shows the real article
 */
export const articleDetailResolver: ResolveFn<FindResult<Record<string, unknown>>> = (route) => {
	const api = injectMomentumAPI();
	const slug = typeof route.params['slug'] === 'string' ? route.params['slug'] : undefined;

	if (!slug) {
		return {
			docs: [],
			totalDocs: 0,
			page: 1,
			totalPages: 0,
			limit: 1,
			hasNextPage: false,
			hasPrevPage: false,
		};
	}

	return api.collection('articles').find({
		where: { slug: { equals: slug } },
		limit: 1,
	});
};

import type { ResolveFn } from '@angular/router';
import { injectMomentumAPI, type FindResult } from '@momentumcms/admin';

export const pageResolver: ResolveFn<FindResult<Record<string, unknown>>> = (route) => {
	const api = injectMomentumAPI();
	const paramSlug: unknown = route.params['slug'];
	const dataSlug: unknown = route.data?.['slug'];
	const slug =
		(typeof paramSlug === 'string' ? paramSlug : undefined) ??
		(typeof dataSlug === 'string' ? dataSlug : undefined) ??
		'home';
	return api.collection('pages').find({
		where: { slug: { equals: slug } },
		limit: 1,
	});
};

import {
	HttpContextToken,
	HttpErrorResponse,
	HttpResponse,
	type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, catchError, throwError } from 'rxjs';
import { FeedbackService } from '../widgets/feedback/feedback.service';

/**
 * Set this context token to `true` on any HTTP request to skip
 * the automatic CUD toast for that specific request.
 *
 * @example
 * ```typescript
 * const context = new HttpContext().set(SKIP_AUTO_TOAST, true);
 * this.http.post('/api/posts', data, { context });
 * ```
 */
export const SKIP_AUTO_TOAST = new HttpContextToken<boolean>(() => false);

/** Routes that are not collection endpoints and should be ignored. */
const EXCLUDED_SLUGS = new Set(['auth', 'setup', 'health', 'config', 'access', 'graphql']);

/**
 * Extract the collection slug from a URL like `/api/{slug}` or `/api/{slug}/{id}`.
 * Returns null for non-collection routes.
 */
function extractCollectionSlug(url: string): string | null {
	const match = /^\/api\/([a-z0-9-]+)/i.exec(url);
	if (!match) return null;
	const slug = match[1];
	if (EXCLUDED_SLUGS.has(slug)) return null;
	return slug;
}

/**
 * Humanize a kebab-case slug into a singular label.
 * "blog-posts" -> "Blog post"
 */
function humanizeSlug(slug: string): string {
	const words = slug.replace(/-/g, ' ').split(' ');
	const capitalized = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
	// Simple singularization: remove trailing 's' unless it ends in 'ss' (e.g., "access")
	if (capitalized.endsWith('s') && !capitalized.endsWith('ss')) {
		return capitalized.slice(0, -1);
	}
	return capitalized;
}

/**
 * Map HTTP method to a human-readable operation name.
 */
function getOperationName(method: string, isBatch: boolean): string {
	if (isBatch) return 'batch operation on';
	switch (method) {
		case 'POST':
			return 'create';
		case 'PATCH':
		case 'PUT':
			return 'update';
		case 'DELETE':
			return 'delete';
		default:
			return 'modify';
	}
}

/**
 * HTTP interceptor that automatically shows toast notifications
 * for CUD (Create, Update, Delete) operations on collection API endpoints.
 *
 * Handles both success and error responses:
 * - Success: Shows appropriate created/updated/deleted toast
 * - Error 400 with validation errors: Shows validation failed toast
 * - Error 403: Shows not authorized toast
 * - Error 404: Shows entity not found toast
 * - Other errors: Shows generic operation failed toast
 *
 * Use `SKIP_AUTO_TOAST` context token to opt out for specific requests.
 */
export const crudToastInterceptor: HttpInterceptorFn = (req, next) => {
	const method = req.method;

	// Only intercept mutating methods
	if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
		return next(req);
	}

	// Skip if the request opted out
	if (req.context.get(SKIP_AUTO_TOAST)) {
		return next(req);
	}

	// Only intercept collection API routes
	const slug = extractCollectionSlug(req.url);
	if (!slug) return next(req);

	const feedback = inject(FeedbackService);
	const label = humanizeSlug(slug);
	const isBatch = req.url.includes('/batch');

	return next(req).pipe(
		tap((event) => {
			if (!(event instanceof HttpResponse)) return;
			if (!event.ok) return;

			if (isBatch) {
				// For batch operations, try to extract count from response
				const body = event.body;
				const count =
					(body && typeof body === 'object' && 'docs' in body && Array.isArray(body.docs)
						? body.docs.length
						: undefined) ??
					(body && typeof body === 'object' && 'results' in body && Array.isArray(body.results)
						? body.results.length
						: undefined);

				if (method === 'DELETE' && count !== undefined) {
					feedback.entitiesDeleted(label, count);
				} else if (method === 'POST' && count !== undefined) {
					feedback.entityCreated(`${count} ${label.toLowerCase()}s`);
				} else {
					feedback.entityUpdated(label);
				}
				return;
			}

			switch (method) {
				case 'POST':
					feedback.entityCreated(label);
					break;
				case 'PATCH':
				case 'PUT':
					feedback.entityUpdated(label);
					break;
				case 'DELETE':
					feedback.entityDeleted(label);
					break;
			}
		}),
		catchError((error: unknown) => {
			if (error instanceof HttpErrorResponse) {
				const operation = getOperationName(method, isBatch);
				const status = error.status;
				const body = error.error;

				if (status === 403) {
					feedback.notAuthorized(`${operation} this ${label.toLowerCase()}`);
				} else if (status === 404) {
					feedback.entityNotFound(label);
				} else if (
					status === 400 &&
					body &&
					typeof body === 'object' &&
					'errors' in body &&
					Array.isArray(body.errors)
				) {
					feedback.validationFailed(body.errors.length);
				} else {
					const message =
						body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
							? body.error
							: `Failed to ${operation} ${label.toLowerCase()}`;
					feedback.operationFailed(message);
				}
			}
			return throwError(() => error);
		}),
	);
};

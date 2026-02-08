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

/** Sub-resource actions that have specific toast behavior. */
const LIFECYCLE_ACTIONS = new Set(['publish', 'unpublish', 'draft']);

/** Sub-resource actions that should be completely skipped by the interceptor. */
const SKIP_ACTIONS = new Set(['status', 'versions', 'versions/restore', 'versions/compare']);

/** Patterns indicating internal server details that should not be shown to users. */
const INTERNAL_ERROR_PATTERNS = [
	/SELECT |INSERT |UPDATE |DELETE |FROM |WHERE /i,
	/\/[a-z_-]+\/[a-z_-]+\//i,
	/at .+\.[jt]s:/,
	/SQLITE_|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
	/relation ".+" does not exist/i,
];

interface UrlInfo {
	slug: string;
	subAction: string | null;
}

/**
 * Extract the collection slug and optional sub-action from a URL.
 * Returns null for non-collection routes.
 *
 * Examples:
 * - `/api/posts`              → { slug: 'posts', subAction: null }
 * - `/api/posts/123`          → { slug: 'posts', subAction: null }
 * - `/api/posts/123/publish`  → { slug: 'posts', subAction: 'publish' }
 * - `/api/posts/batch`        → { slug: 'posts', subAction: null } (batch detected separately)
 */
function extractUrlInfo(url: string): UrlInfo | null {
	const match = /^\/api\/([a-z0-9-]+)/i.exec(url);
	if (!match) return null;
	const slug = match[1];
	if (EXCLUDED_SLUGS.has(slug)) return null;

	// Check for sub-actions: /api/{slug}/{id}/{action} or /api/{slug}/{id}/versions/{action}
	const actionMatch =
		/^\/api\/[a-z0-9-]+\/[a-z0-9-]+\/(publish|unpublish|draft|status|versions(?:\/restore|\/compare)?)(?:\?|$)/i.exec(
			url,
		);
	const subAction = actionMatch ? actionMatch[1].toLowerCase() : null;

	return { slug, subAction };
}

/**
 * Humanize a kebab-case slug into a singular label.
 * "blog-posts" -> "Blog Post"
 */
function humanizeSlug(slug: string): string {
	const words = slug.replace(/-/g, ' ').split(' ');
	const capitalized = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
	// Simple singularization: remove trailing 's' unless it ends in 'ss' (e.g., "business")
	if (capitalized.endsWith('s') && !capitalized.endsWith('ss')) {
		return capitalized.slice(0, -1);
	}
	return capitalized;
}

/**
 * Humanize a kebab-case slug into a plural label (no singularization).
 * "blog-posts" -> "Blog Posts", "business" -> "Business"
 */
function humanizeSlugPlural(slug: string): string {
	const words = slug.replace(/-/g, ' ').split(' ');
	return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Sanitize error messages from server responses to prevent leaking
 * internal details (SQL, file paths, stack traces) to end users.
 */
function sanitizeErrorMessage(message: string, fallback: string): string {
	for (const pattern of INTERNAL_ERROR_PATTERNS) {
		if (pattern.test(message)) return fallback;
	}
	return message;
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
	const urlInfo = extractUrlInfo(req.url);
	if (!urlInfo) return next(req);

	const { slug, subAction } = urlInfo;

	// Skip sub-actions that don't need toasts (read-only or handled elsewhere)
	if (subAction && SKIP_ACTIONS.has(subAction)) {
		return next(req);
	}

	const feedback = inject(FeedbackService);
	const label = humanizeSlug(slug);
	const isBatch = req.url.includes('/batch');

	return next(req).pipe(
		tap((event) => {
			if (!(event instanceof HttpResponse)) return;
			if (!event.ok) return;

			// Handle lifecycle sub-actions (publish, unpublish, draft)
			if (subAction && LIFECYCLE_ACTIONS.has(subAction)) {
				switch (subAction) {
					case 'publish':
						feedback.entityPublished(label);
						break;
					case 'unpublish':
						feedback.entityUnpublished(label);
						break;
					case 'draft':
						feedback.draftSaved();
						break;
				}
				return;
			}

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
					// Use plural form from slug directly (avoids naive re-pluralization)
					feedback.entityCreated(`${count} ${humanizeSlugPlural(slug).toLowerCase()}`);
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
					const fallback = `Failed to ${operation} ${label.toLowerCase()}`;
					const message =
						body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
							? sanitizeErrorMessage(body.error, fallback)
							: fallback;
					feedback.operationFailed(message);
				}
			}
			return throwError(() => error);
		}),
	);
};

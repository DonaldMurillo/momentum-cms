/**
 * Express router for form builder public API endpoints.
 *
 * Endpoints:
 * - GET  /forms/:idOrSlug/schema   → Returns form schema for rendering
 * - POST /forms/:idOrSlug/validate → Validates data against form schema
 * - POST /forms/:idOrSlug/submit   → Validates, saves submission, fires webhooks
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { MomentumAPI } from '@momentumcms/core';
import {
	validateForm,
	evaluateConditions,
	type FormFieldConfig,
} from '@momentumcms/form-builder/validation';
import {
	dispatchFormWebhooks,
	type FormWebhookConfig,
	type FormSubmissionPayload,
} from '../services/submission-forwarder';

export interface FormApiRouterOptions {
	getApi: () => MomentumAPI | null;
	honeypot: boolean;
	rateLimitPerMinute: number;
	logger?: { info: (msg: string) => void; error: (msg: string) => void };
}

interface FormDoc {
	id: string;
	slug: string;
	title: string;
	status: string;
	schema: { fields: FormFieldConfig[] };
	webhooks: FormWebhookConfig[];
	honeypot: boolean;
	submissionCount: number;
	successMessage?: string;
	redirectUrl?: string;
}

/** Minimal collection operations shape for type-safe API usage. */
interface CollectionOps {
	findById(id: string): Promise<Record<string, unknown> | null>;
	find(query: Record<string, unknown>): Promise<{ docs: Record<string, unknown>[] }>;
	create(data: Record<string, unknown>): Promise<Record<string, unknown>>;
	update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

function getCollection(api: MomentumAPI, slug: string): CollectionOps {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection() returns unknown
	return api.collection(slug) as CollectionOps;
}

/**
 * Simple in-memory rate limiter keyed by IP.
 * Periodically prunes stale entries to prevent unbounded memory growth.
 */
function createRateLimiter(maxPerMinute: number): (ip: string) => boolean {
	const requests = new Map<string, number[]>();
	let lastPrune = Date.now();

	return (ip: string): boolean => {
		const now = Date.now();
		const windowStart = now - 60_000;

		// Prune stale entries every 5 minutes to prevent memory leaks
		if (now - lastPrune > 300_000) {
			for (const [key, timestamps] of requests) {
				const active = timestamps.filter((t) => t > windowStart);
				if (active.length === 0) {
					requests.delete(key);
				} else {
					requests.set(key, active);
				}
			}
			lastPrune = now;
		}

		const timestamps = (requests.get(ip) ?? []).filter((t) => t > windowStart);
		if (timestamps.length >= maxPerMinute) {
			requests.set(ip, timestamps);
			return false;
		}
		timestamps.push(now);
		requests.set(ip, timestamps);
		return true;
	};
}

/**
 * Sanitize submission body to only include schema-defined field names.
 * Prevents storing arbitrary extra keys or prototype pollution attempts.
 */
function sanitizeSubmissionData(
	body: Record<string, unknown>,
	fields: FormFieldConfig[],
): Record<string, unknown> {
	const allowedKeys = new Set(fields.map((f) => f.name));
	const sanitized: Record<string, unknown> = {};
	for (const key of allowedKeys) {
		if (Object.prototype.hasOwnProperty.call(body, key)) {
			sanitized[key] = body[key];
		}
	}
	return sanitized;
}

function isRecord(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Filter fields to only those currently visible based on their conditions and submitted values.
 * Fields without conditions are always visible.
 */
function filterVisibleFields(
	fields: FormFieldConfig[],
	values: Record<string, unknown>,
): FormFieldConfig[] {
	return fields.filter((f) => {
		if (!f.conditions || f.conditions.length === 0) return true;
		return evaluateConditions(f.conditions, values);
	});
}

/**
 * Resolve a form by id or slug. Published forms only for public endpoints.
 */
async function resolveForm(
	api: MomentumAPI,
	idOrSlug: string,
	requirePublished = true,
): Promise<FormDoc | null> {
	const forms = getCollection(api, 'forms');

	// Try by ID first
	const byId = (await forms.findById(idOrSlug)) ?? null;
	if (byId) {
		if (requirePublished && byId['status'] !== 'published') return null;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI returns generic Records
		return byId as unknown as FormDoc;
	}

	// Try by slug
	const bySlug = await forms.find({
		where: { slug: { equals: idOrSlug } },
		limit: 1,
	});

	const doc = bySlug.docs[0] ?? null;
	if (!doc) return null;
	if (requirePublished && doc['status'] !== 'published') return null;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI returns generic Records
	return doc as unknown as FormDoc;
}

/**
 * Create the Express router for form public API endpoints.
 */
export function createFormApiRouter(options: FormApiRouterOptions): Router {
	const { getApi, honeypot, rateLimitPerMinute, logger } = options;
	const checkRateLimit = createRateLimiter(rateLimitPerMinute);
	const router = Router();

	// GET /forms/:idOrSlug/schema
	router.get('/forms/:idOrSlug/schema', async (req: Request, res: Response) => {
		try {
			const api = getApi();
			if (!api) {
				res.status(503).json({ error: 'Service unavailable' });
				return;
			}

			const formDoc = await resolveForm(api, req.params['idOrSlug'] ?? '');
			if (!formDoc) {
				res.status(404).json({ error: 'Form not found' });
				return;
			}

			res.json({
				id: formDoc.id,
				slug: formDoc.slug,
				title: formDoc.title,
				schema: formDoc.schema,
				honeypot: formDoc.honeypot && honeypot,
				successMessage: formDoc.successMessage,
				redirectUrl: formDoc.redirectUrl,
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger?.error(`GET /forms/schema failed: ${msg}`);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	// POST /forms/:idOrSlug/validate
	router.post('/forms/:idOrSlug/validate', async (req: Request, res: Response) => {
		try {
			const api = getApi();
			if (!api) {
				res.status(503).json({ error: 'Service unavailable' });
				return;
			}

			// Rate limiting — same as /submit to prevent abuse
			const ip = req.ip ?? 'unknown';
			if (!checkRateLimit(ip)) {
				res.status(429).json({ valid: false, error: 'Too many requests' });
				return;
			}

			const formDoc = await resolveForm(api, req.params['idOrSlug'] ?? '');
			if (!formDoc) {
				res.status(404).json({ error: 'Form not found' });
				return;
			}

			const body = isRecord(req.body) ? req.body : {};
			const allFields = formDoc.schema?.fields ?? [];
			// Only validate visible fields — skip conditionally hidden ones
			const fields = filterVisibleFields(allFields, body);
			const errors = validateForm(fields, body);

			if (errors.length > 0) {
				res.status(422).json({ valid: false, errors });
			} else {
				res.json({ valid: true, errors: [] });
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger?.error(`POST /forms/validate failed: ${msg}`);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	// POST /forms/:idOrSlug/submit
	router.post('/forms/:idOrSlug/submit', async (req: Request, res: Response) => {
		try {
			const api = getApi();
			if (!api) {
				res.status(503).json({ error: 'Service unavailable' });
				return;
			}

			// Rate limiting — use req.ip which respects Express trust proxy config
			const ip = req.ip ?? 'unknown';
			if (!checkRateLimit(ip)) {
				res.status(429).json({ error: 'Too many requests' });
				return;
			}

			const formDoc = await resolveForm(api, req.params['idOrSlug'] ?? '');
			if (!formDoc) {
				res.status(404).json({ error: 'Form not found' });
				return;
			}

			const body = isRecord(req.body) ? req.body : {};

			// Honeypot check
			if (formDoc.honeypot && honeypot && body['_hp_field']) {
				// Silently reject — bots expect 200
				res.json({ success: true, message: formDoc.successMessage ?? 'Thank you!' });
				return;
			}

			// Validate — only visible fields (skip conditionally hidden ones)
			const allFields = formDoc.schema?.fields ?? [];
			const fields = filterVisibleFields(allFields, body);
			const errors = validateForm(fields, body);
			if (errors.length > 0) {
				res.status(422).json({ success: false, errors });
				return;
			}

			// Sanitize: only store schema-defined fields
			const sanitizedData = sanitizeSubmissionData(body, fields);

			// Save submission
			const metadata = {
				ip,
				userAgent: req.headers['user-agent'] ?? '',
				submittedAt: new Date().toISOString(),
			};

			await getCollection(api, 'form-submissions').create({
				formId: formDoc.id,
				formSlug: formDoc.slug,
				formTitle: formDoc.title,
				data: sanitizedData,
				metadata,
			});

			// Increment submission count — re-fetch to reduce race window
			const freshForm = await getCollection(api, 'forms').findById(formDoc.id);
			const currentCount =
				typeof freshForm?.['submissionCount'] === 'number' ? freshForm['submissionCount'] : 0;
			await getCollection(api, 'forms').update(formDoc.id, { submissionCount: currentCount + 1 });

			// Fire webhooks (non-blocking)
			const webhooks = Array.isArray(formDoc.webhooks) ? formDoc.webhooks : [];
			if (webhooks.length > 0) {
				const payload: FormSubmissionPayload = {
					formId: formDoc.id,
					formSlug: formDoc.slug,
					formTitle: formDoc.title,
					data: sanitizedData,
					submittedAt: metadata.submittedAt,
				};
				dispatchFormWebhooks(webhooks, payload, logger);
			}

			res.json({
				success: true,
				message: formDoc.successMessage ?? 'Thank you!',
				redirectUrl: formDoc.redirectUrl,
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger?.error(`POST /forms/submit failed: ${msg}`);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	return router;
}

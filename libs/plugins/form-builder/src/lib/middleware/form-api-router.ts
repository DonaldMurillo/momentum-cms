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
	find(
		query: Record<string, unknown>,
	): Promise<{ docs: Record<string, unknown>[]; totalDocs?: number }>;
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
 * Hardened validation with two-pass condition evaluation.
 *
 * 1. Validate unconditional fields first.
 * 2. Only evaluate conditions when controlling fields passed validation.
 *    If a controlling field has errors, treat dependent conditional fields as VISIBLE
 *    (so their required checks still apply).
 * 3. Validate visible conditional fields.
 *
 * This prevents bypassing required field validation by submitting invalid
 * values for controlling fields.
 */
function validateWithConditions(
	allFields: FormFieldConfig[],
	body: Record<string, unknown>,
): { errors: ReturnType<typeof validateForm>; visibleFields: FormFieldConfig[] } {
	const unconditional: FormFieldConfig[] = [];
	const conditional: FormFieldConfig[] = [];

	for (const field of allFields) {
		if (field.conditions && field.conditions.length > 0) {
			conditional.push(field);
		} else {
			unconditional.push(field);
		}
	}

	// Pass 1: validate all unconditional fields
	const unconditionalErrors = validateForm(unconditional, body);
	const fieldsWithErrors = new Set(unconditionalErrors.map((e) => e.field));

	// Pass 2: evaluate conditions — if a controlling field has errors, treat
	// dependent fields as visible (fail-open for security)
	const visibleConditional = conditional.filter((f) => {
		const conditions = f.conditions ?? [];
		const controllerHasErrors = conditions.some((c) => fieldsWithErrors.has(c.field));
		if (controllerHasErrors) return true; // Controller invalid → show dependent field
		return evaluateConditions(conditions, body);
	});

	const conditionalErrors = validateForm(visibleConditional, body);
	const visibleFields = [...unconditional, ...visibleConditional];
	const errors = [...unconditionalErrors, ...conditionalErrors];

	return { errors, visibleFields };
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
			const ip = req.ip || req.socket?.remoteAddress || 'unknown';
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
			// Hardened validation — prevents bypass via invalid controller values
			const { errors } = validateWithConditions(allFields, body);

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
			const ip = req.ip || req.socket?.remoteAddress || 'unknown';
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

			// Hardened validation — prevents bypass via invalid controller values
			const allFields = formDoc.schema?.fields ?? [];
			const { errors, visibleFields } = validateWithConditions(allFields, body);
			if (errors.length > 0) {
				res.status(422).json({ success: false, errors });
				return;
			}

			// Sanitize: only store schema-defined fields
			const sanitizedData = sanitizeSubmissionData(body, visibleFields);

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

			// Update submission count — count actual submissions to avoid TOCTOU races
			const { totalDocs } = await getCollection(api, 'form-submissions').find({
				where: { formId: { equals: formDoc.id } },
				limit: 0,
			});
			await getCollection(api, 'forms').update(formDoc.id, {
				submissionCount:
					typeof totalDocs === 'number' ? totalDocs : (formDoc.submissionCount ?? 0) + 1,
			});

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

/**
 * Webhook Dispatcher
 *
 * Dispatches webhook POST requests when collection events occur.
 * Supports HMAC-SHA256 signature verification and configurable retries.
 */

import { createHmac, randomUUID } from 'node:crypto';
import type {
	CollectionConfig,
	HookFunction,
	WebhookConfig,
	WebhookEvent,
	WebhookPayload,
} from '@momentumcms/core';
import { createLogger } from '@momentumcms/logger';

const webhookLogger = createLogger('Webhook');

/** Maximum number of webhook delivery retries. Caps exponential backoff to prevent excessive delays. */
const MAX_WEBHOOK_RETRIES = 5;

/**
 * Sign a webhook payload with HMAC-SHA256.
 * Returns the hex-encoded signature.
 */
function signPayload(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Check if a webhook URL is safe to call.
 * Blocks private IP ranges, localhost, and non-http(s) protocols to prevent SSRF.
 * Set MOMENTUM_ALLOW_PRIVATE_WEBHOOKS=true to allow localhost/private IPs (e.g. for testing).
 */
function isAllowedWebhookUrl(url: string): boolean {
	try {
		const parsed = new URL(url);

		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return false;
		}

		// Allow private/localhost URLs when explicitly opted in (e.g. for E2E testing)
		if (process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'] === 'true') {
			return true;
		}

		const hostname = parsed.hostname.toLowerCase();

		// IPv6 addresses in URLs come through hostname as "::ffff:127.0.0.1"
		// (without brackets) — normalize by stripping brackets for matching.
		const normalizedHost = hostname.replace(/^\[|\]$/g, '');

		const blockedPatterns = [
			// IPv4 loopback / private ranges
			/^localhost$/,
			/^127\./,
			/^10\./,
			/^172\.(1[6-9]|2\d|3[01])\./,
			/^192\.168\./,
			/^169\.254\./,
			/^0\./,
			// IPv6 loopback (all representations)
			/^::1$/,
			/^0:0:0:0:0:0:0:1$/,
			// IPv6 ULA / link-local
			/^fc00:/i,
			/^fe80:/i,
			// IPv6-mapped IPv4 (::ffff:127.0.0.1, ::ffff:10.0.0.1, etc.)
			// Also catches hex form like ::ffff:7f00:1 (= 127.0.0.1)
			/^::ffff:/i,
		];

		return !blockedPatterns.some((p) => p.test(normalizedHost));
	} catch {
		return false;
	}
}

/**
 * Send a single webhook request with retry support.
 * Runs in the background (fire-and-forget).
 */
async function sendWebhook(
	webhook: WebhookConfig,
	payload: WebhookPayload,
	attempt = 0,
): Promise<void> {
	if (!isAllowedWebhookUrl(webhook.url)) {
		webhookLogger.warn(`Blocked request to disallowed URL: ${webhook.url}`);
		return;
	}

	// Cap retries to prevent unbounded exponential backoff; clamp to 0 minimum
	const maxRetries = Math.max(0, Math.min(webhook.retries ?? 0, MAX_WEBHOOK_RETRIES));

	try {
		// Serialize inside try/catch — circular references in payload throw synchronously,
		// and since sendWebhook is fire-and-forget (void sendWebhook(...)), unhandled
		// rejections from outside try/catch would crash the process.
		const body = JSON.stringify(payload, (_key, value) =>
			typeof value === 'bigint' ? Number(value) : value,
		);

		// Custom headers spread FIRST so standard/security headers below can't be overridden
		const headers: Record<string, string> = {
			...(webhook.headers ?? {}),
			'Content-Type': 'application/json',
			'X-Momentum-Event': payload.event,
			'X-Momentum-Collection': payload.collection,
			'X-Momentum-Delivery': randomUUID(),
		};

		if (webhook.secret) {
			headers['X-Momentum-Signature'] = signPayload(body, webhook.secret);
		}
		const response = await fetch(webhook.url, {
			method: 'POST',
			headers,
			body,
			redirect: 'error', // Prevent SSRF via redirect to private IPs
			signal: AbortSignal.timeout(10_000), // 10s timeout
		});

		if (!response.ok && attempt < maxRetries) {
			// Exponential backoff: 1s, 2s, 4s, ...
			const delay = Math.pow(2, attempt) * 1000;
			await new Promise((resolve) => setTimeout(resolve, delay));
			return sendWebhook(webhook, payload, attempt + 1);
		}

		if (!response.ok) {
			webhookLogger.warn(
				`Failed after ${attempt + 1} attempt(s) to ${webhook.url}: ${response.status} ${response.statusText}`,
			);
		}
	} catch (error) {
		// JSON.stringify circular reference — retrying won't fix it
		if (error instanceof TypeError && error.message.includes('circular')) {
			webhookLogger.warn(
				`Failed to serialize webhook payload for ${webhook.url}: ${error.message}`,
			);
			return;
		}

		if (attempt < maxRetries) {
			const delay = Math.pow(2, attempt) * 1000;
			await new Promise((resolve) => setTimeout(resolve, delay));
			return sendWebhook(webhook, payload, attempt + 1);
		}

		const message = error instanceof Error ? error.message : 'Unknown error';
		webhookLogger.warn(`Error after ${attempt + 1} attempt(s) to ${webhook.url}: ${message}`);
	}
}

/**
 * Dispatch webhooks for a collection event.
 * Runs all matching webhooks in parallel, fire-and-forget.
 */
function dispatchWebhooks(
	webhooks: WebhookConfig[],
	event: WebhookEvent,
	payload: WebhookPayload,
): void {
	const matching = webhooks.filter((w) => {
		// If no events configured, fire for all events
		if (!w.events || w.events.length === 0) return true;
		return w.events.includes(event);
	});

	for (const webhook of matching) {
		// Fire-and-forget: don't await, don't block the response
		void sendWebhook(webhook, payload);
	}
}

/**
 * Create afterChange hook that dispatches webhooks on create/update.
 */
function createWebhookAfterChangeHook(collection: CollectionConfig): HookFunction {
	return (args) => {
		const webhooks = collection.webhooks;
		if (!webhooks || webhooks.length === 0) return;

		const operation = args.operation ?? 'create';
		const doc = args.doc ?? args.data ?? {};

		const event: WebhookEvent = operation === 'create' ? 'afterCreate' : 'afterUpdate';

		const payload: WebhookPayload = {
			event,
			collection: collection.slug,
			operation,
			timestamp: new Date().toISOString(),
			doc,
			previousDoc: args.originalDoc,
		};

		// Dispatch both specific event and generic afterChange
		dispatchWebhooks(webhooks, event, payload);
		dispatchWebhooks(webhooks, 'afterChange', {
			...payload,
			event: 'afterChange',
		});
	};
}

/**
 * Create afterDelete hook that dispatches webhooks on delete.
 */
function createWebhookAfterDeleteHook(collection: CollectionConfig): HookFunction {
	return (args) => {
		const webhooks = collection.webhooks;
		if (!webhooks || webhooks.length === 0) return;

		const doc = args.doc ?? {};

		const payload: WebhookPayload = {
			event: 'afterDelete',
			collection: collection.slug,
			operation: 'delete',
			timestamp: new Date().toISOString(),
			doc,
		};

		dispatchWebhooks(webhooks, 'afterDelete', payload);
	};
}

/**
 * Register webhook hooks for all collections that have webhook configs.
 * Call this during server initialization, before initializeMomentumAPI().
 */
export function registerWebhookHooks(collections: CollectionConfig[]): void {
	for (const collection of collections) {
		if (!collection.webhooks || collection.webhooks.length === 0) {
			continue;
		}

		collection.hooks = collection.hooks ?? {};

		// Append webhook hooks (run after user-defined hooks)
		const existingAfterChange = collection.hooks.afterChange ?? [];
		collection.hooks.afterChange = [
			...existingAfterChange,
			createWebhookAfterChangeHook(collection),
		];

		const existingAfterDelete = collection.hooks.afterDelete ?? [];
		collection.hooks.afterDelete = [
			...existingAfterDelete,
			createWebhookAfterDeleteHook(collection),
		];
	}
}

// Re-export for testing and reuse
export { sendWebhook, dispatchWebhooks, signPayload, isAllowedWebhookUrl };

/**
 * DNS rebinding limitation: isAllowedWebhookUrl validates the hostname against
 * a blocklist of private IP patterns, but fetch() resolves DNS *after* this check.
 * An attacker with a domain that resolves to a private IP (e.g. via DNS rebinding
 * services like 1u.ms) can bypass all hostname patterns. For a CMS webhook dispatcher
 * where admins configure their own URLs, this is considered acceptable risk.
 * Mitigation: redirect: 'error' on fetch prevents redirect-based SSRF.
 */

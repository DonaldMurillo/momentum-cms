/**
 * Forwards form submissions to configured webhook URLs.
 *
 * Uses the same HMAC signing and SSRF protection from
 * @momentumcms/server-core webhooks.
 */

import { createHmac } from 'crypto';
import { isAllowedWebhookUrl } from '@momentumcms/server-core';

export interface FormWebhookConfig {
	/** Webhook URL to POST the submission to */
	url: string;
	/** Optional secret for HMAC-SHA256 signing */
	secret?: string;
	/** Custom headers to include */
	headers?: Record<string, string>;
}

export interface FormSubmissionPayload {
	formId: string;
	formSlug: string;
	formTitle: string;
	data: Record<string, unknown>;
	submittedAt: string;
}

/**
 * Sign a payload with HMAC-SHA256.
 */
export function signPayload(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Send a single webhook with retry support.
 */
export async function sendFormWebhook(
	webhook: FormWebhookConfig,
	payload: FormSubmissionPayload,
	maxRetries = 3,
): Promise<boolean> {
	if (!isAllowedWebhookUrl(webhook.url)) {
		return false;
	}

	const body = JSON.stringify(payload);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...webhook.headers,
	};

	if (webhook.secret) {
		headers['X-Momentum-Signature'] = signPayload(body, webhook.secret);
	}

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(webhook.url, {
				method: 'POST',
				headers,
				body,
				signal: AbortSignal.timeout(10_000),
			});

			if (response.ok) return true;

			// Don't retry 4xx (client error)
			if (response.status >= 400 && response.status < 500) return false;
		} catch {
			// Network error or timeout — retry
		}

		// Exponential backoff before next retry
		if (attempt < maxRetries) {
			// eslint-disable-next-line local/no-direct-browser-apis -- Server-side Node.js code, not browser
			await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
		}
	}

	return false;
}

/**
 * Dispatch a submission to all configured webhooks (fire-and-forget).
 */
export function dispatchFormWebhooks(
	webhooks: FormWebhookConfig[],
	payload: FormSubmissionPayload,
	logger?: { error: (msg: string) => void },
): void {
	for (const webhook of webhooks) {
		sendFormWebhook(webhook, payload).catch((err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			if (logger) {
				logger.error(`Form webhook to ${webhook.url} failed: ${msg}`);
			}
		});
	}
}

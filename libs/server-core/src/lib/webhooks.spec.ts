import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAllowedWebhookUrl, sendWebhook, signPayload } from './webhooks';
import type { WebhookConfig, WebhookPayload } from '@momentumcms/core';

// ============================================
// isAllowedWebhookUrl — SSRF prevention tests
// ============================================

describe('isAllowedWebhookUrl', () => {
	const originalEnv = process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'];

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'];
		} else {
			process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'] = originalEnv;
		}
	});

	// --- Valid public URLs should be allowed ---
	it('should allow https public URLs', () => {
		expect(isAllowedWebhookUrl('https://example.com/webhook')).toBe(true);
	});

	it('should allow http public URLs', () => {
		expect(isAllowedWebhookUrl('http://example.com/webhook')).toBe(true);
	});

	it('should allow URLs with ports', () => {
		expect(isAllowedWebhookUrl('https://example.com:8443/webhook')).toBe(true);
	});

	// --- Protocol restrictions ---
	it('should reject ftp:// protocol', () => {
		expect(isAllowedWebhookUrl('ftp://example.com/file')).toBe(false);
	});

	it('should reject file:// protocol', () => {
		expect(isAllowedWebhookUrl('file:///etc/passwd')).toBe(false);
	});

	it('should reject data: protocol', () => {
		expect(isAllowedWebhookUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
	});

	it('should reject javascript: protocol', () => {
		expect(isAllowedWebhookUrl('javascript:alert(1)')).toBe(false);
	});

	it('should reject empty string', () => {
		expect(isAllowedWebhookUrl('')).toBe(false);
	});

	// --- IPv4 loopback / private IP blocking ---
	it('should block 127.0.0.1', () => {
		expect(isAllowedWebhookUrl('http://127.0.0.1/secret')).toBe(false);
	});

	it('should block localhost', () => {
		expect(isAllowedWebhookUrl('http://localhost/secret')).toBe(false);
	});

	it('should block 10.x.x.x (Class A private)', () => {
		expect(isAllowedWebhookUrl('http://10.0.0.1/secret')).toBe(false);
	});

	it('should block 172.16.x.x (Class B private)', () => {
		expect(isAllowedWebhookUrl('http://172.16.0.1/secret')).toBe(false);
	});

	it('should block 192.168.x.x (Class C private)', () => {
		expect(isAllowedWebhookUrl('http://192.168.1.1/secret')).toBe(false);
	});

	it('should block 169.254.x.x (link-local / AWS metadata)', () => {
		expect(isAllowedWebhookUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
	});

	it('should block 0.0.0.0', () => {
		expect(isAllowedWebhookUrl('http://0.0.0.0/secret')).toBe(false);
	});

	// --- Abbreviated IP forms (Node normalizes these via new URL()) ---
	it('should block abbreviated loopback 127.1 (normalized to 127.0.0.1)', () => {
		expect(isAllowedWebhookUrl('http://127.1/secret')).toBe(false);
	});

	it('should block abbreviated private 10.1 (normalized to 10.0.0.1)', () => {
		expect(isAllowedWebhookUrl('http://10.1/secret')).toBe(false);
	});

	it('should block hex IP 0x7f000001 (normalized to 127.0.0.1)', () => {
		expect(isAllowedWebhookUrl('http://0x7f000001/secret')).toBe(false);
	});

	it('should block decimal IP 2130706433 (normalized to 127.0.0.1)', () => {
		expect(isAllowedWebhookUrl('http://2130706433/secret')).toBe(false);
	});

	it('should block octal IP 0177.0.0.1 (normalized to 127.0.0.1)', () => {
		expect(isAllowedWebhookUrl('http://0177.0.0.1/secret')).toBe(false);
	});

	it('should block hex octets 0x7f.0x00.0x00.0x01 (normalized to 127.0.0.1)', () => {
		expect(isAllowedWebhookUrl('http://0x7f.0x00.0x00.0x01/secret')).toBe(false);
	});

	// --- IPv6 loopback blocking ---
	it('should block [::1] (IPv6 loopback)', () => {
		expect(isAllowedWebhookUrl('http://[::1]/secret')).toBe(false);
	});

	it('should block ::1 without brackets', () => {
		// URL.hostname for http://[::1] is "::1"
		expect(isAllowedWebhookUrl('http://[::1]/secret')).toBe(false);
	});

	// --- IPv6-mapped IPv4 SSRF bypass ---
	it('should block ::ffff:127.0.0.1 (IPv6-mapped loopback)', () => {
		expect(isAllowedWebhookUrl('http://[::ffff:127.0.0.1]/secret')).toBe(false);
	});

	it('should block ::ffff:10.0.0.1 (IPv6-mapped Class A private)', () => {
		expect(isAllowedWebhookUrl('http://[::ffff:10.0.0.1]/secret')).toBe(false);
	});

	it('should block ::ffff:172.16.0.1 (IPv6-mapped Class B private)', () => {
		expect(isAllowedWebhookUrl('http://[::ffff:172.16.0.1]/secret')).toBe(false);
	});

	it('should block ::ffff:192.168.1.1 (IPv6-mapped Class C private)', () => {
		expect(isAllowedWebhookUrl('http://[::ffff:192.168.1.1]/secret')).toBe(false);
	});

	it('should block ::ffff:169.254.169.254 (IPv6-mapped link-local)', () => {
		expect(isAllowedWebhookUrl('http://[::ffff:169.254.169.254]/latest/meta-data/')).toBe(false);
	});

	// --- IPv6 loopback variants ---
	it('should block [0:0:0:0:0:0:0:1] (expanded IPv6 loopback)', () => {
		expect(isAllowedWebhookUrl('http://[0:0:0:0:0:0:0:1]/secret')).toBe(false);
	});

	// --- IPv6 ULA / link-local ---
	it('should block fc00: addresses (IPv6 ULA)', () => {
		expect(isAllowedWebhookUrl('http://[fc00::1]/secret')).toBe(false);
	});

	it('should block fe80: addresses (IPv6 link-local)', () => {
		expect(isAllowedWebhookUrl('http://[fe80::1]/secret')).toBe(false);
	});

	// --- Username/password in URL ---
	it('should block URLs with userinfo pointing to localhost', () => {
		expect(isAllowedWebhookUrl('http://user:pass@127.0.0.1/secret')).toBe(false);
	});

	it('should block URLs with userinfo pointing to private IP', () => {
		expect(isAllowedWebhookUrl('http://attacker@10.0.0.1/secret')).toBe(false);
	});

	// --- ENV override ---
	it('should allow private URLs when MOMENTUM_ALLOW_PRIVATE_WEBHOOKS=true', () => {
		process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'] = 'true';
		expect(isAllowedWebhookUrl('http://127.0.0.1/test')).toBe(true);
		expect(isAllowedWebhookUrl('http://[::ffff:127.0.0.1]/test')).toBe(true);
	});

	it('should still reject non-http protocols even with env override', () => {
		process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'] = 'true';
		expect(isAllowedWebhookUrl('ftp://127.0.0.1/file')).toBe(false);
	});
});

// ============================================
// signPayload — HMAC signature
// ============================================

describe('signPayload', () => {
	it('should produce a deterministic hex-encoded HMAC-SHA256', () => {
		const payload = '{"event":"afterCreate"}';
		const secret = 'wh-secret-test';
		const sig = signPayload(payload, secret);
		// HMAC-SHA256 hex is 64 chars
		expect(sig).toHaveLength(64);
		expect(sig).toMatch(/^[0-9a-f]{64}$/);
		// Same input → same output
		expect(signPayload(payload, secret)).toBe(sig);
	});

	it('should produce different signatures for different secrets', () => {
		const payload = '{"event":"afterCreate"}';
		const sig1 = signPayload(payload, 'secret-1');
		const sig2 = signPayload(payload, 'secret-2');
		expect(sig1).not.toBe(sig2);
	});
});

// ============================================
// sendWebhook — SSRF redirect protection
// ============================================

describe('sendWebhook', () => {
	const originalEnv = process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'];

	beforeEach(() => {
		delete process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'];
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'] = originalEnv;
		} else {
			delete process.env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'];
		}
		vi.restoreAllMocks();
	});

	const basePayload: WebhookPayload = {
		event: 'afterCreate',
		collection: 'posts',
		operation: 'create',
		timestamp: '2025-01-01T00:00:00Z',
		doc: { id: '1', title: 'Test' },
	};

	it('should not follow redirects to private IPs', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(null, {
				status: 302,
				headers: { Location: 'http://169.254.169.254/latest/meta-data/' },
			}),
		);

		const webhook: WebhookConfig = {
			url: 'https://evil.com/redirect-to-metadata',
			events: ['afterCreate'],
		};

		await sendWebhook(webhook, basePayload);

		// The fetch should be called with redirect: 'error' to prevent following
		expect(fetchSpy).toHaveBeenCalledOnce();
		const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(fetchOptions.redirect).toBe('error');
	});

	it('should send HMAC signature when secret is configured', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 200 }));

		const webhook: WebhookConfig = {
			url: 'https://example.com/webhook',
			secret: 'test-secret',
			events: ['afterCreate'],
		};

		await sendWebhook(webhook, basePayload);

		expect(fetchSpy).toHaveBeenCalledOnce();
		const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
		expect(headers['X-Momentum-Signature']).toBeDefined();
		expect(headers['X-Momentum-Signature']).toHaveLength(64);
	});

	it('should include custom headers from webhook config', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 200 }));

		const webhook: WebhookConfig = {
			url: 'https://example.com/webhook',
			headers: { 'X-Custom': 'value' },
			events: ['afterCreate'],
		};

		await sendWebhook(webhook, basePayload);

		const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
		expect(headers['X-Custom']).toBe('value');
	});

	it('should block webhooks to disallowed URLs without making a fetch', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		const webhook: WebhookConfig = {
			url: 'http://127.0.0.1/secret',
			events: ['afterCreate'],
		};

		await sendWebhook(webhook, basePayload);

		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should cap retries at 5 even when config requests more', async () => {
		vi.useFakeTimers();

		// Mock fetch to always fail
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

		const webhook: WebhookConfig = {
			url: 'https://example.com/webhook',
			retries: 50, // Very high retry count — should be capped
			events: ['afterCreate'],
		};

		const promise = sendWebhook(webhook, basePayload);

		// With cap at 5 retries, max total delay = sum(2^0..2^4) * 1000 = 31s
		await vi.advanceTimersByTimeAsync(35_000);
		await promise;

		// Initial call + 5 retries = 6 total fetch calls
		expect(fetchSpy).toHaveBeenCalledTimes(6);

		vi.useRealTimers();
	});

	it('should clamp negative retries to 0 (no retries)', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

		const webhook: WebhookConfig = {
			url: 'https://example.com/webhook',
			retries: -5, // Negative — should be clamped to 0
			events: ['afterCreate'],
		};

		await sendWebhook(webhook, basePayload);

		// Only the initial call, no retries
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it('should handle circular references in payload without crashing', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		// Create a circular reference in the payload
		const circularDoc: Record<string, unknown> = { id: '1' };
		circularDoc['self'] = circularDoc;

		const payloadWithCircular: WebhookPayload = {
			...basePayload,
			doc: circularDoc,
		};

		const webhook: WebhookConfig = {
			url: 'https://example.com/webhook',
			events: ['afterCreate'],
		};

		// Should not throw — catches the TypeError internally
		await sendWebhook(webhook, payloadWithCircular);

		// fetch should NOT be called — serialization failed
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should not allow custom headers to override X-Momentum-Signature', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 200 }));

		const webhook: WebhookConfig = {
			url: 'https://example.com/webhook',
			secret: 'real-secret',
			headers: { 'X-Momentum-Signature': 'forged-signature' },
			events: ['afterCreate'],
		};

		await sendWebhook(webhook, basePayload);

		expect(fetchSpy).toHaveBeenCalledOnce();
		const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;

		// The custom header should have been set first, then overridden by the real signature
		const sig = headers['X-Momentum-Signature'];
		expect(sig).toBeDefined();
		expect(sig).toHaveLength(64); // HMAC-SHA256 hex
		expect(sig).not.toBe('forged-signature'); // Must NOT be the forged value
	});

	it('should not allow custom headers to override standard headers', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 200 }));

		const webhook: WebhookConfig = {
			url: 'https://example.com/webhook',
			headers: {
				'Content-Type': 'text/plain', // Try to override
				'X-Momentum-Event': 'fake-event', // Try to override
			},
			events: ['afterCreate'],
		};

		await sendWebhook(webhook, basePayload);

		const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
		// Standard headers should win over custom headers
		expect(headers['Content-Type']).toBe('application/json');
		expect(headers['X-Momentum-Event']).toBe(basePayload.event);
	});
});

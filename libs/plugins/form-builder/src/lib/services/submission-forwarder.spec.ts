import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signPayload, sendFormWebhook, dispatchFormWebhooks } from './submission-forwarder';
import type { FormSubmissionPayload, FormWebhookConfig } from './submission-forwarder';

const SAMPLE_PAYLOAD: FormSubmissionPayload = {
	formId: 'form-1',
	formSlug: 'contact-us',
	formTitle: 'Contact Us',
	data: { name: 'John', email: 'john@example.com' },
	submittedAt: '2026-02-27T00:00:00.000Z',
};

describe('signPayload', () => {
	it('should produce a hex string', () => {
		const sig = signPayload('{"hello":"world"}', 'my-secret');
		expect(sig).toMatch(/^[a-f0-9]{64}$/);
	});

	it('should produce different signatures for different secrets', () => {
		const sig1 = signPayload('data', 'secret-1');
		const sig2 = signPayload('data', 'secret-2');
		expect(sig1).not.toBe(sig2);
	});

	it('should produce the same signature for the same input', () => {
		const sig1 = signPayload('data', 'secret');
		const sig2 = signPayload('data', 'secret');
		expect(sig1).toBe(sig2);
	});
});

describe('SSRF protection', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should block localhost URLs', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const result = await sendFormWebhook({ url: 'http://localhost:8080/hook' }, SAMPLE_PAYLOAD, 0);
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should block 127.x.x.x URLs', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const result = await sendFormWebhook({ url: 'http://127.0.0.1:3000/hook' }, SAMPLE_PAYLOAD, 0);
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should block private 10.x.x.x URLs', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const result = await sendFormWebhook({ url: 'http://10.0.0.5/hook' }, SAMPLE_PAYLOAD, 0);
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should block private 192.168.x.x URLs', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const result = await sendFormWebhook({ url: 'http://192.168.1.1/hook' }, SAMPLE_PAYLOAD, 0);
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should block AWS metadata endpoint', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const result = await sendFormWebhook(
			{ url: 'http://169.254.169.254/latest/meta-data/' },
			SAMPLE_PAYLOAD,
			0,
		);
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should block non-HTTP protocols', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const result = await sendFormWebhook({ url: 'file:///etc/passwd' }, SAMPLE_PAYLOAD, 0);
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should block invalid URLs', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const result = await sendFormWebhook({ url: 'not-a-url' }, SAMPLE_PAYLOAD, 0);
		expect(result).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('should allow public HTTPS URLs', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('OK', { status: 200 }));
		const result = await sendFormWebhook(
			{ url: 'https://hooks.example.com/form' },
			SAMPLE_PAYLOAD,
			0,
		);
		expect(result).toBe(true);
	});
});

describe('sendFormWebhook', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should return true on successful response and send correct body', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true }), { status: 200 }),
		);

		const result = await sendFormWebhook({ url: 'https://example.com/hook' }, SAMPLE_PAYLOAD, 0);
		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledOnce();

		const call = vi.mocked(fetch).mock.calls[0];
		const fetchOptions = call?.[1] as RequestInit;
		expect(JSON.parse(fetchOptions.body as string)).toEqual(SAMPLE_PAYLOAD);
	});

	it('should return false on 4xx response without retrying', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('Bad Request', { status: 400 }),
		);

		const result = await sendFormWebhook({ url: 'https://example.com/hook' }, SAMPLE_PAYLOAD, 2);
		expect(result).toBe(false);
		// Should NOT retry on 4xx
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('should retry on 5xx and return false after exhausting retries', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Server Error', { status: 500 }));

		const result = await sendFormWebhook(
			{ url: 'https://example.com/hook' },
			SAMPLE_PAYLOAD,
			1, // 1 retry = 2 total attempts
		);
		expect(result).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('should include X-Momentum-Signature header when secret is provided', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('OK', { status: 200 }));

		const webhook: FormWebhookConfig = {
			url: 'https://example.com/hook',
			secret: 'my-secret',
		};

		await sendFormWebhook(webhook, SAMPLE_PAYLOAD, 0);

		const call = vi.mocked(fetch).mock.calls[0];
		const fetchOptions = call?.[1] as RequestInit;
		const headers = fetchOptions.headers as Record<string, string>;
		expect(headers['X-Momentum-Signature']).toMatch(/^[a-f0-9]{64}$/);
	});

	it('should include custom headers', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('OK', { status: 200 }));

		const webhook: FormWebhookConfig = {
			url: 'https://example.com/hook',
			headers: { 'X-Custom': 'value' },
		};

		await sendFormWebhook(webhook, SAMPLE_PAYLOAD, 0);

		const call = vi.mocked(fetch).mock.calls[0];
		const fetchOptions = call?.[1] as RequestInit;
		const headers = fetchOptions.headers as Record<string, string>;
		expect(headers['X-Custom']).toBe('value');
	});
});

describe('dispatchFormWebhooks', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should dispatch to all webhooks', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('OK', { status: 200 }));

		const webhooks: FormWebhookConfig[] = [
			{ url: 'https://a.com/hook' },
			{ url: 'https://b.com/hook' },
		];

		dispatchFormWebhooks(webhooks, SAMPLE_PAYLOAD);

		// Allow fire-and-forget promises to resolve
		await vi.waitFor(() => {
			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});
		expect(fetchSpy).toHaveBeenCalledWith('https://a.com/hook', expect.any(Object));
		expect(fetchSpy).toHaveBeenCalledWith('https://b.com/hook', expect.any(Object));
	});

	it('should not throw when webhooks array is empty', () => {
		expect(() => dispatchFormWebhooks([], SAMPLE_PAYLOAD)).not.toThrow();
	});
});

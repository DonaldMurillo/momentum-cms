import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchUrlPattern, parseRulesResponse } from '../client/rule-engine';

describe('matchUrlPattern', () => {
	it('should match wildcard * against any pathname', () => {
		expect(matchUrlPattern('*', '/anything')).toBe(true);
		expect(matchUrlPattern('*', '/')).toBe(true);
		expect(matchUrlPattern('*', '/blog/post/1')).toBe(true);
	});

	it('should match exact paths', () => {
		expect(matchUrlPattern('/pricing', '/pricing')).toBe(true);
		expect(matchUrlPattern('/pricing', '/blog')).toBe(false);
	});

	it('should match single segment wildcard', () => {
		expect(matchUrlPattern('/blog/*', '/blog/hello')).toBe(true);
		expect(matchUrlPattern('/blog/*', '/blog/world')).toBe(true);
		expect(matchUrlPattern('/blog/*', '/blog/nested/path')).toBe(false);
		expect(matchUrlPattern('/blog/*', '/blog')).toBe(false);
	});

	it('should match double-star globstar for any path depth', () => {
		expect(matchUrlPattern('/blog/**', '/blog/hello')).toBe(true);
		expect(matchUrlPattern('/blog/**', '/blog/nested/deep/path')).toBe(true);
		expect(matchUrlPattern('/blog/**', '/blog')).toBe(false);
	});

	it('should match paths with dots (e.g., file extensions)', () => {
		expect(matchUrlPattern('/docs/*.html', '/docs/index.html')).toBe(true);
		expect(matchUrlPattern('/docs/*.html', '/docs/about.html')).toBe(true);
		expect(matchUrlPattern('/docs/*.html', '/docs/nothtml')).toBe(false);
	});

	it('should not match partial paths', () => {
		expect(matchUrlPattern('/blog', '/blog/post')).toBe(false);
		expect(matchUrlPattern('/blog/post', '/blog')).toBe(false);
	});
});

describe('parseRulesResponse', () => {
	it('should parse valid rules from server response', () => {
		const data = {
			rules: [
				{
					name: 'CTA Click',
					selector: '.cta',
					eventType: 'click',
					eventName: 'cta_click',
					urlPattern: '/pricing',
					properties: { section: 'header' },
					active: true,
					rateLimit: 10,
				},
			],
		};

		const result = parseRulesResponse(data);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('CTA Click');
		expect(result[0].selector).toBe('.cta');
		expect(result[0].eventType).toBe('click');
		expect(result[0].eventName).toBe('cta_click');
		expect(result[0].urlPattern).toBe('/pricing');
		expect(result[0].rateLimit).toBe(10);
	});

	it('should return empty for non-object responses', () => {
		expect(parseRulesResponse(null)).toEqual([]);
		expect(parseRulesResponse('string')).toEqual([]);
		expect(parseRulesResponse(42)).toEqual([]);
	});

	it('should return empty when rules is not an array', () => {
		expect(parseRulesResponse({ rules: 'not-array' })).toEqual([]);
		expect(parseRulesResponse({ other: [] })).toEqual([]);
	});

	it('should skip invalid rules (missing selector or eventName)', () => {
		const data = {
			rules: [
				{ name: 'No selector', eventName: 'test' },
				{ name: 'No eventName', selector: '.btn' },
				{ selector: '.valid', eventName: 'valid_event', active: true },
			],
		};

		const result = parseRulesResponse(data);
		expect(result).toHaveLength(1);
		expect(result[0].eventName).toBe('valid_event');
	});

	it('should default eventType to click when missing', () => {
		const data = {
			rules: [{ selector: '.btn', eventName: 'test' }],
		};

		const result = parseRulesResponse(data);
		expect(result[0].eventType).toBe('click');
	});

	it('should default urlPattern to * when missing', () => {
		const data = {
			rules: [{ selector: '.btn', eventName: 'test' }],
		};

		const result = parseRulesResponse(data);
		expect(result[0].urlPattern).toBe('*');
	});
});

describe('createRuleEngine lifecycle', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
		vi.stubGlobal('document', {
			body: {
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				querySelectorAll: vi.fn().mockReturnValue([]),
			},
		});
		vi.stubGlobal('location', { pathname: '/' });
		vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
		vi.stubGlobal('history', {
			pushState: vi.fn(),
			replaceState: vi.fn(),
		});
		vi.stubGlobal(
			'IntersectionObserver',
			vi.fn().mockImplementation(() => ({
				observe: vi.fn(),
				unobserve: vi.fn(),
				disconnect: vi.fn(),
			})),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should fetch rules and handle empty response gracefully', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ rules: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);

		const { createRuleEngine } = await import('../client/rule-engine');
		const tracker = { track: vi.fn() };
		const engine = createRuleEngine(tracker as never);

		await engine.start();

		expect(fetchMock).toHaveBeenCalledWith('/api/analytics/tracking-rules');
	});

	it('should silently handle fetch failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

		const { createRuleEngine } = await import('../client/rule-engine');
		const tracker = { track: vi.fn() };
		const engine = createRuleEngine(tracker as never);

		// Should not throw
		await engine.start();
	});

	it('should silently handle non-ok response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

		const { createRuleEngine } = await import('../client/rule-engine');
		const tracker = { track: vi.fn() };
		const engine = createRuleEngine(tracker as never);

		// Should not throw
		await engine.start();
	});

	it('should use custom endpoint when configured', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ rules: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);

		const { createRuleEngine } = await import('../client/rule-engine');
		const tracker = { track: vi.fn() };
		const engine = createRuleEngine(tracker as never, {
			endpoint: '/custom/rules',
		});

		await engine.start();

		expect(fetchMock).toHaveBeenCalledWith('/custom/rules');
	});

	it('should clean up on stop', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					rules: [
						{
							selector: '.btn',
							eventType: 'click',
							eventName: 'click_test',
							urlPattern: '*',
							active: true,
						},
					],
				}),
			}),
		);

		const { createRuleEngine } = await import('../client/rule-engine');
		const tracker = { track: vi.fn() };
		const engine = createRuleEngine(tracker as never);

		await engine.start();
		engine.stop();

		// Should not throw when calling stop again
		engine.stop();
	});
});

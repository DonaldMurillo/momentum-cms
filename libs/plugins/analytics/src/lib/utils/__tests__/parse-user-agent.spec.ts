import { describe, it, expect } from 'vitest';
import { parseUserAgent } from '../parse-user-agent';

describe('parseUserAgent', () => {
	it('should return unknown for undefined input', () => {
		const result = parseUserAgent(undefined);
		expect(result).toEqual({ device: 'unknown', browser: 'unknown', os: 'unknown' });
	});

	it('should return unknown for empty string', () => {
		const result = parseUserAgent('');
		expect(result).toEqual({ device: 'unknown', browser: 'unknown', os: 'unknown' });
	});

	it('should detect Chrome on Windows desktop', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
		const result = parseUserAgent(ua);
		expect(result.device).toBe('desktop');
		expect(result.browser).toBe('Chrome');
		expect(result.os).toBe('Windows');
	});

	it('should detect Safari on macOS desktop', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
		const result = parseUserAgent(ua);
		expect(result.device).toBe('desktop');
		expect(result.browser).toBe('Safari');
		expect(result.os).toBe('macOS');
	});

	it('should detect Firefox on Linux desktop', () => {
		const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
		const result = parseUserAgent(ua);
		expect(result.device).toBe('desktop');
		expect(result.browser).toBe('Firefox');
		expect(result.os).toBe('Linux');
	});

	it('should detect Chrome on Android mobile', () => {
		const ua =
			'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
		const result = parseUserAgent(ua);
		expect(result.device).toBe('mobile');
		expect(result.browser).toBe('Chrome');
		expect(result.os).toBe('Android');
	});

	it('should detect Safari on iPhone', () => {
		const ua =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
		const result = parseUserAgent(ua);
		expect(result.device).toBe('mobile');
		expect(result.browser).toBe('Safari');
		expect(result.os).toBe('iOS');
	});

	it('should detect iPad as tablet', () => {
		const ua =
			'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
		const result = parseUserAgent(ua);
		expect(result.device).toBe('tablet');
		expect(result.os).toBe('iOS');
	});

	it('should detect Edge browser', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
		const result = parseUserAgent(ua);
		expect(result.browser).toBe('Edge');
	});
});

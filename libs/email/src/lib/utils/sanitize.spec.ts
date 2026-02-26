import { describe, it, expect } from 'vitest';
import {
	sanitizeAlignment,
	sanitizeCssValue,
	sanitizeCssNumber,
	sanitizeUrl,
	sanitizeFontFamily,
} from './sanitize';

describe('sanitizeAlignment', () => {
	it('should accept "left"', () => {
		expect(sanitizeAlignment('left')).toBe('left');
	});

	it('should accept "center"', () => {
		expect(sanitizeAlignment('center')).toBe('center');
	});

	it('should accept "right"', () => {
		expect(sanitizeAlignment('right')).toBe('right');
	});

	it('should reject HTML attribute injection and return "left"', () => {
		expect(sanitizeAlignment('left" onmouseover="alert(1)')).toBe('left');
	});

	it('should reject arbitrary strings and return "left"', () => {
		expect(sanitizeAlignment('justify')).toBe('left');
	});

	it('should reject empty string and return "left"', () => {
		expect(sanitizeAlignment('')).toBe('left');
	});
});

describe('sanitizeCssValue', () => {
	it('should allow simple color hex', () => {
		expect(sanitizeCssValue('#ff0000')).toBe('#ff0000');
	});

	it('should allow named colors', () => {
		expect(sanitizeCssValue('red')).toBe('red');
	});

	it('should allow simple margin values', () => {
		expect(sanitizeCssValue('24px 0')).toBe('24px 0');
	});

	it('should strip semicolons to prevent CSS property injection', () => {
		expect(sanitizeCssValue('red; background-image: url(evil.com)')).toBe(
			'red background-image: urlevil.com',
		);
	});

	it('should strip parentheses to prevent url() injection', () => {
		expect(sanitizeCssValue('red; background: url(https://evil.com/track)')).toBe(
			'red background: urlhttps://evil.com/track',
		);
	});

	it('should strip curly braces', () => {
		expect(sanitizeCssValue('red} .evil { color: blue')).toBe('red .evil  color: blue');
	});

	it('should strip angle brackets to prevent HTML breakout', () => {
		expect(sanitizeCssValue('red</style><script>alert(1)</script>')).toBe(
			'red/stylescriptalert1/script',
		);
	});

	it('should strip quotes', () => {
		expect(sanitizeCssValue(`red" onclick="alert(1)`)).toBe('red onclick=alert1');
		expect(sanitizeCssValue(`red' onclick='alert(1)`)).toBe('red onclick=alert1');
	});

	it('should strip backslashes', () => {
		expect(sanitizeCssValue('red\\0aevil')).toBe('red0aevil');
	});

	it('should return empty string for fully malicious input', () => {
		const result = sanitizeCssValue(';{}()"\'<>\\');
		expect(result).toBe('');
	});
});

describe('sanitizeFontFamily', () => {
	it('should preserve single quotes around font names with spaces', () => {
		const input =
			"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
		expect(sanitizeFontFamily(input)).toBe(input);
	});

	it('should strip dangerous characters like semicolons and angle brackets', () => {
		expect(sanitizeFontFamily('Arial</style><script>alert(1)</script>')).toBe(
			'Arial/stylescriptalert1/script',
		);
	});

	it('should strip curly braces', () => {
		expect(sanitizeFontFamily('Arial} body { color: red')).toBe('Arial body  color: red');
	});

	it('should strip parentheses to prevent url() injection', () => {
		expect(sanitizeFontFamily("Arial; background: url('evil')")).toBe(
			"Arial background: url'evil'",
		);
	});

	it('should strip backslashes', () => {
		expect(sanitizeFontFamily('Arial\\0a, monospace')).toBe('Arial0a, monospace');
	});

	it('should allow simple unquoted font names', () => {
		expect(sanitizeFontFamily('monospace')).toBe('monospace');
	});

	it('should strip double quotes to prevent HTML attribute breakout', () => {
		expect(sanitizeFontFamily('"Segoe UI", Arial')).toBe('Segoe UI, Arial');
	});

	it('should block HTML attribute injection via double quotes', () => {
		const malicious = 'Arial" onmouseover="alert(1)" x="';
		const result = sanitizeFontFamily(malicious);
		// Double quotes are the breakout vector — once stripped, remaining text
		// is harmless inside style="font-family: ..."
		expect(result).not.toContain('"');
		expect(result).toBe('Arial onmouseover=alert1 x=');
	});

	it('should preserve single quotes for font names with spaces', () => {
		expect(sanitizeFontFamily("'Segoe UI', Arial")).toBe("'Segoe UI', Arial");
	});
});

describe('sanitizeCssNumber', () => {
	it('should accept valid positive integers', () => {
		expect(sanitizeCssNumber(16, 16)).toBe('16');
	});

	it('should accept valid positive floats', () => {
		expect(sanitizeCssNumber(1.5, 16)).toBe('1.5');
	});

	it('should accept zero', () => {
		expect(sanitizeCssNumber(0, 16)).toBe('0');
	});

	it('should accept string numbers', () => {
		expect(sanitizeCssNumber('24', 16)).toBe('24');
	});

	it('should reject negative numbers and return fallback', () => {
		expect(sanitizeCssNumber(-1, 16)).toBe('16');
	});

	it('should reject NaN and return fallback', () => {
		expect(sanitizeCssNumber('not-a-number', 16)).toBe('16');
	});

	it('should reject Infinity and return fallback', () => {
		expect(sanitizeCssNumber(Infinity, 16)).toBe('16');
	});

	it('should reject CSS injection string and return fallback', () => {
		expect(sanitizeCssNumber('16; color: red', 16)).toBe('16');
	});

	it('should reject null and return fallback', () => {
		expect(sanitizeCssNumber(null, 16)).toBe('16');
	});

	it('should reject undefined and return fallback', () => {
		expect(sanitizeCssNumber(undefined, 16)).toBe('16');
	});
});

describe('sanitizeUrl', () => {
	it('should allow https URLs', () => {
		expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
	});

	it('should allow http URLs', () => {
		expect(sanitizeUrl('http://example.com/page')).toBe('http://example.com/page');
	});

	it('should allow mailto URLs', () => {
		expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
	});

	it('should allow anchor fragment', () => {
		expect(sanitizeUrl('#section')).toBe('#section');
	});

	it('should allow relative paths', () => {
		expect(sanitizeUrl('/about')).toBe('/about');
	});

	it('should return # for empty string', () => {
		expect(sanitizeUrl('')).toBe('#');
	});

	it('should return # for whitespace-only string', () => {
		expect(sanitizeUrl('   ')).toBe('#');
	});

	it('should pass through bare # unchanged', () => {
		expect(sanitizeUrl('#')).toBe('#');
	});

	it('should block javascript: protocol', () => {
		expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
	});

	it('should block javascript: with mixed case', () => {
		expect(sanitizeUrl('JavaScript:alert(1)')).toBe('#');
	});

	it('should block data: protocol', () => {
		expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
	});

	it('should block vbscript: protocol', () => {
		expect(sanitizeUrl('vbscript:MsgBox("XSS")')).toBe('#');
	});

	it('should block ftp: protocol', () => {
		expect(sanitizeUrl('ftp://evil.com/file')).toBe('#');
	});

	it('should trim whitespace before validation', () => {
		expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
	});

	it('should block javascript: with leading whitespace', () => {
		expect(sanitizeUrl('  javascript:alert(1)')).toBe('#');
	});

	it('should block javascript: with tab character', () => {
		expect(sanitizeUrl('\tjavascript:alert(1)')).toBe('#');
	});

	it('should block bare domain (ambiguous without protocol)', () => {
		expect(sanitizeUrl('evil.com')).toBe('#');
	});
});

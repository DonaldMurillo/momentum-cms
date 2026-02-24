import { describe, it, expect } from 'vitest';
import { sanitizeAlignment, sanitizeCssValue, sanitizeCssNumber } from './sanitize';

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

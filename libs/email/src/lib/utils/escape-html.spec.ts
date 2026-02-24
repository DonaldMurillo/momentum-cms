import { describe, it, expect } from 'vitest';
import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
	it('should escape ampersands', () => {
		expect(escapeHtml('a&b')).toBe('a&amp;b');
	});

	it('should escape less-than signs', () => {
		expect(escapeHtml('a<b')).toBe('a&lt;b');
	});

	it('should escape greater-than signs', () => {
		expect(escapeHtml('a>b')).toBe('a&gt;b');
	});

	it('should escape double quotes', () => {
		expect(escapeHtml('a"b')).toBe('a&quot;b');
	});

	it('should escape single quotes', () => {
		expect(escapeHtml("a'b")).toBe('a&#039;b');
	});

	it('should escape all special characters together', () => {
		expect(escapeHtml('<script>alert("xss")</script>')).toBe(
			'&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
		);
	});

	it('should return empty string unchanged', () => {
		expect(escapeHtml('')).toBe('');
	});

	it('should return safe strings unchanged', () => {
		expect(escapeHtml('hello world')).toBe('hello world');
	});
});

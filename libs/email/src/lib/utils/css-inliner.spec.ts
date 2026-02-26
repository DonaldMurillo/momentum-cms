import { describe, it, expect } from 'vitest';
import { inlineCss } from './css-inliner';

describe('inlineCss', () => {
	it('should inline class-based CSS into style attributes', () => {
		const html = `
			<html><head><style>.red { color: red; }</style></head>
			<body><p class="red">Hello</p></body></html>
		`;
		const result = inlineCss(html);
		expect(result).toContain('style="color: red;');
	});

	it('should remove style tags after inlining', () => {
		const html = `
			<html><head><style>.blue { color: blue; }</style></head>
			<body><p class="blue">Hello</p></body></html>
		`;
		const result = inlineCss(html);
		// Style tag should be removed (non-media-query styles)
		expect(result).not.toContain('<style>.blue');
	});

	it('should preserve media queries in style tags', () => {
		const html = `
			<html><head><style>
				.btn { padding: 10px; }
				@media (max-width: 600px) { .btn { padding: 5px; } }
			</style></head>
			<body><a class="btn">Click</a></body></html>
		`;
		const result = inlineCss(html);
		expect(result).toContain('@media');
		expect(result).toContain('max-width: 600px');
	});

	it('should handle HTML with no styles', () => {
		const html = '<html><body><p>No styles</p></body></html>';
		const result = inlineCss(html);
		expect(result).toContain('<p>No styles</p>');
	});

	it('should inline existing inline styles alongside class styles', () => {
		const html = `
			<html><head><style>.pad { padding: 10px; }</style></head>
			<body><p class="pad" style="margin: 0;">Text</p></body></html>
		`;
		const result = inlineCss(html);
		expect(result).toContain('padding: 10px');
		expect(result).toContain('margin: 0');
	});
});

import { describe, it, expect, vi } from 'vitest';
import { renderEmailFromBlocks } from './render-blocks';
import type { EmailTemplate } from '../../types';
import type { EmailBlock } from '../../types';

describe('renderEmailFromBlocks', () => {
	it('should render a simple text block', () => {
		const template: EmailTemplate = {
			blocks: [{ type: 'text', data: { content: 'Hello world' }, id: '1' }],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('Hello world');
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('</html>');
	});

	it('should render a header block with title and subtitle', () => {
		const template: EmailTemplate = {
			blocks: [
				{
					type: 'header',
					data: { title: 'Welcome', subtitle: 'Get started today' },
					id: '1',
				},
			],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('Welcome');
		expect(html).toContain('Get started today');
		expect(html).toContain('<h1');
	});

	it('should render a button block with href', () => {
		const template: EmailTemplate = {
			blocks: [
				{
					type: 'button',
					data: { label: 'Click Me', href: 'https://example.com' },
					id: '1',
				},
			],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('Click Me');
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('role="presentation"');
	});

	it('should render an image block', () => {
		const template: EmailTemplate = {
			blocks: [
				{
					type: 'image',
					data: { src: 'https://example.com/logo.png', alt: 'Logo', width: '200' },
					id: '1',
				},
			],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('src="https://example.com/logo.png"');
		expect(html).toContain('alt="Logo"');
	});

	it('should render a divider block', () => {
		const template: EmailTemplate = {
			blocks: [{ type: 'divider', data: {}, id: '1' }],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('<hr');
		expect(html).toContain('border-top: 1px solid');
	});

	it('should render a spacer block', () => {
		const template: EmailTemplate = {
			blocks: [{ type: 'spacer', data: { height: 32 }, id: '1' }],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('height: 32px');
	});

	it('should render a footer block', () => {
		const template: EmailTemplate = {
			blocks: [{ type: 'footer', data: { text: '2026 Acme Inc.' }, id: '1' }],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('2026 Acme Inc.');
		expect(html).toContain('font-size: 12px');
	});

	it('should render multiple blocks in order', () => {
		const template: EmailTemplate = {
			blocks: [
				{ type: 'header', data: { title: 'Title' }, id: '1' },
				{ type: 'text', data: { content: 'Body text' }, id: '2' },
				{ type: 'button', data: { label: 'CTA', href: '#' }, id: '3' },
			],
		};
		const html = renderEmailFromBlocks(template);
		const titleIdx = html.indexOf('Title');
		const bodyIdx = html.indexOf('Body text');
		const ctaIdx = html.indexOf('CTA');
		expect(titleIdx).toBeLessThan(bodyIdx);
		expect(bodyIdx).toBeLessThan(ctaIdx);
	});

	it('should apply custom theme colors', () => {
		const template: EmailTemplate = {
			blocks: [{ type: 'text', data: { content: 'Themed' }, id: '1' }],
			theme: {
				primaryColor: '#ff0000',
				backgroundColor: '#000000',
				textColor: '#00ff00',
				mutedColor: '#888888',
				fontFamily: 'monospace',
				borderRadius: '0px',
			},
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('background-color: #000000');
		expect(html).toContain('color: #00ff00');
		expect(html).toContain('monospace');
	});

	it('should escape HTML in block data to prevent XSS', () => {
		const template: EmailTemplate = {
			blocks: [
				{
					type: 'text',
					data: { content: '<script>alert("xss")</script>' },
					id: '1',
				},
			],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('should handle unknown block types gracefully', () => {
		const template: EmailTemplate = {
			blocks: [{ type: 'unknown-widget', data: {}, id: '1' }],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('<!-- unknown block type: unknown-widget -->');
	});

	it('should render columns block', () => {
		const template: EmailTemplate = {
			blocks: [
				{
					type: 'columns',
					data: {
						columns: [
							{ blocks: [{ type: 'text', data: { content: 'Left' }, id: 'a' }] },
							{ blocks: [{ type: 'text', data: { content: 'Right' }, id: 'b' }] },
						],
					},
					id: '1',
				},
			],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('Left');
		expect(html).toContain('Right');
		expect(html).toContain('width: 50%');
	});

	it('should render image with link wrapper when href is set', () => {
		const template: EmailTemplate = {
			blocks: [
				{
					type: 'image',
					data: {
						src: 'https://example.com/img.png',
						alt: 'Photo',
						href: 'https://example.com',
					},
					id: '1',
				},
			],
		};
		const html = renderEmailFromBlocks(template);
		expect(html).toContain('<a href="https://example.com"');
		expect(html).toContain('<img');
	});

	// --- Issue #5: Block validation ---

	describe('block validation', () => {
		it('should skip blocks with data: null without crashing', () => {
			const template: EmailTemplate = {
				blocks: [{ type: 'text', data: null as never, id: '1' }],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('</html>');
		});

		it('should skip blocks missing type field without crashing', () => {
			const template: EmailTemplate = {
				blocks: [{ data: { content: 'test' }, id: '1' } as unknown as EmailBlock],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('</html>');
		});

		it('should skip primitive values in blocks array without crashing', () => {
			const template: EmailTemplate = {
				blocks: ['string', 42, null] as unknown as EmailBlock[],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('</html>');
		});

		it('should render valid blocks and skip invalid ones', () => {
			const template: EmailTemplate = {
				blocks: [
					{ type: 'text', data: { content: 'Valid block' }, id: '1' },
					{ type: 'text', data: null as never, id: '2' },
					{ type: 'header', data: { title: 'Also valid' }, id: '3' },
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).toContain('Valid block');
			expect(html).toContain('Also valid');
		});

		it('should warn when skipping invalid blocks', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
			const template: EmailTemplate = {
				blocks: [{ type: 'text', data: null as never, id: '1' }],
			};
			renderEmailFromBlocks(template);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('[momentum:email]'),
				expect.anything(),
			);
			warnSpy.mockRestore();
		});
	});

	// --- URL protocol sanitization ---

	describe('URL sanitization', () => {
		it('should block javascript: in button href', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'button',
						data: { label: 'Click', href: 'javascript:alert(1)' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('javascript:');
			expect(html).toContain('href="#"');
		});

		it('should block data: URLs in image src', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'image',
						data: { src: 'data:text/html,<script>alert(1)</script>', alt: 'x' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('data:text/html');
		});

		it('should block javascript: in image href', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'image',
						data: { src: 'https://img.png', alt: 'x', href: 'javascript:void(0)' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('javascript:');
		});

		it('should allow valid https URLs in button href', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'button',
						data: { label: 'Go', href: 'https://safe.com' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).toContain('href="https://safe.com"');
		});

		it('should render empty image block as HTML comment', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'image',
						data: { src: '', alt: 'placeholder' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('<img');
			expect(html).toContain('<!-- image block: no src configured -->');
		});
	});

	// --- Block ID validation ---

	describe('block id validation', () => {
		it('should skip blocks without an id field', () => {
			const template: EmailTemplate = {
				blocks: [{ type: 'text', data: { content: 'no-id' } } as unknown as EmailBlock],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('no-id');
		});

		it('should skip blocks with empty id', () => {
			const template: EmailTemplate = {
				blocks: [{ type: 'text', data: { content: 'empty-id' }, id: '' }],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('empty-id');
		});

		it('should skip blocks with non-string id', () => {
			const template: EmailTemplate = {
				blocks: [{ type: 'text', data: { content: 'num-id' }, id: 42 as unknown as string }],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('num-id');
		});
	});

	// --- Columns block validation ---

	describe('columns block hardening', () => {
		it('should handle non-array columns data gracefully', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'columns',
						data: { columns: 'not-an-array' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).toContain('<table');
		});

		it('should filter out invalid nested blocks in columns', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'columns',
						data: {
							columns: [
								{
									blocks: [
										{ type: 'text', data: { content: 'Valid' }, id: 'a' },
										{ type: 'text', data: null } as unknown as EmailBlock,
									],
								},
							],
						},
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).toContain('Valid');
		});
	});

	// --- Theme sanitization ---

	describe('theme sanitization', () => {
		it('should sanitize theme fontFamily to prevent XSS breakout', () => {
			const template: EmailTemplate = {
				blocks: [{ type: 'text', data: { content: 'Test' }, id: '1' }],
				theme: {
					primaryColor: '#000',
					backgroundColor: '#fff',
					textColor: '#333',
					mutedColor: '#999',
					fontFamily: 'Arial</style><script>alert(1)</script>',
					borderRadius: '8px',
				},
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('<script>');
			expect(html).not.toContain('</style>');
		});

		it('should sanitize theme backgroundColor', () => {
			const template: EmailTemplate = {
				blocks: [{ type: 'text', data: { content: 'Test' }, id: '1' }],
				theme: {
					primaryColor: '#000',
					backgroundColor: '#fff; background-image: url(evil)',
					textColor: '#333',
					mutedColor: '#999',
					fontFamily: 'Arial',
					borderRadius: '8px',
				},
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('url(');
		});
	});

	// --- Issue #6: CSS/attribute sanitization ---

	describe('CSS and attribute sanitization', () => {
		it('should sanitize alignment to prevent HTML attribute injection', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'header',
						data: { title: 'Test', alignment: 'left" onmouseover="alert(1)' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('onmouseover');
			expect(html).toContain('text-align: left');
		});

		it('should sanitize color to prevent CSS injection', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'text',
						data: { content: 'Test', color: 'red; background-image: url(evil.com)' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			// Semicolons stripped — can't declare new CSS property
			expect(html).not.toContain('color: red;');
			// Parens stripped — url() injection vector broken
			expect(html).not.toContain('url(');
		});

		it('should sanitize backgroundColor to prevent CSS injection in button', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'button',
						data: {
							label: 'Click',
							href: '#',
							backgroundColor: '#000; background: url(https://evil.com/track)',
						},
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('url(');
		});

		it('should sanitize image width to prevent attribute injection', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'image',
						data: { src: 'img.png', alt: 'x', width: '100%" onerror="alert(1)' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			// Quotes stripped — cannot break out of the width attribute
			expect(html).not.toContain('onerror="');
			// Parens stripped — alert() call broken
			expect(html).not.toContain('alert(');
		});

		it('should sanitize divider margin to prevent CSS injection', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'divider',
						data: { margin: '24px 0; background: url(track.gif)' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			expect(html).not.toContain('url(');
		});

		it('should sanitize fontSize to a valid number', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'text',
						data: { content: 'Test', fontSize: '16; color: red' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			// Should fall back to default 16, not contain injection
			expect(html).not.toContain('color: red');
			expect(html).toContain('font-size: 16px');
		});

		it('should sanitize spacer height to a valid number', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'spacer',
						data: { height: 'javascript:alert(1)' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			// Should fall back to default 24
			expect(html).toContain('height: 24px');
		});

		it('should sanitize footer color to prevent CSS injection', () => {
			const template: EmailTemplate = {
				blocks: [
					{
						type: 'footer',
						data: { text: 'Footer', color: '#000; } body { background: red' },
						id: '1',
					},
				],
			};
			const html = renderEmailFromBlocks(template);
			// Semicolons stripped — can't end current property and start new one
			expect(html).not.toContain('#000;');
			// Braces stripped — can't break out of style into CSS rule
			expect(html).not.toContain('} body');
			expect(html).not.toContain('{ background');
		});
	});
});

import { blocksToPreviewHtml } from './preview-renderer';
import type { EmailBlock, EmailTheme } from '@momentumcms/email';

function makeBlock(type: string, data: Record<string, unknown> = {}): EmailBlock {
	return { type, id: `block-${type}`, data };
}

describe('blocksToPreviewHtml', () => {
	it('should produce a valid HTML document', () => {
		const html = blocksToPreviewHtml([]);
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('<html');
		expect(html).toContain('</html>');
	});

	it('should render a text block', () => {
		const html = blocksToPreviewHtml([makeBlock('text', { content: 'Hello world', fontSize: 14 })]);
		expect(html).toContain('Hello world');
		expect(html).toContain('font-size: 14px');
	});

	it('should render a header block', () => {
		const html = blocksToPreviewHtml([
			makeBlock('header', { title: 'Welcome', subtitle: 'To the app' }),
		]);
		expect(html).toContain('Welcome');
		expect(html).toContain('To the app');
		expect(html).toContain('font-size: 24px');
	});

	it('should render a button block', () => {
		const html = blocksToPreviewHtml([
			makeBlock('button', { label: 'Click', href: 'https://example.com' }),
		]);
		expect(html).toContain('Click');
		expect(html).toContain('href="https://example.com"');
	});

	it('should render an image block', () => {
		const html = blocksToPreviewHtml([
			makeBlock('image', { src: 'https://example.com/img.png', alt: 'Logo' }),
		]);
		expect(html).toContain('src="https://example.com/img.png"');
		expect(html).toContain('alt="Logo"');
	});

	it('should render a divider block', () => {
		const html = blocksToPreviewHtml([makeBlock('divider')]);
		expect(html).toContain('border-top: 1px solid');
	});

	it('should render a spacer block', () => {
		const html = blocksToPreviewHtml([makeBlock('spacer', { height: 48 })]);
		expect(html).toContain('height: 48px');
	});

	it('should render a footer block', () => {
		const html = blocksToPreviewHtml([makeBlock('footer', { text: 'Unsubscribe' })]);
		expect(html).toContain('Unsubscribe');
		expect(html).toContain('font-size: 12px');
	});

	it('should render multiple blocks in order', () => {
		const html = blocksToPreviewHtml([
			makeBlock('header', { title: 'Title' }),
			makeBlock('text', { content: 'Body text' }),
			makeBlock('button', { label: 'CTA', href: '#' }),
		]);
		const titleIdx = html.indexOf('Title');
		const bodyIdx = html.indexOf('Body text');
		const ctaIdx = html.indexOf('CTA');
		expect(titleIdx).toBeLessThan(bodyIdx);
		expect(bodyIdx).toBeLessThan(ctaIdx);
	});

	it('should apply custom theme colors', () => {
		const theme: Partial<EmailTheme> = {
			backgroundColor: '#000000',
			textColor: '#ffffff',
			primaryColor: '#ff0000',
		};
		const html = blocksToPreviewHtml([makeBlock('text', { content: 'Themed' })], theme);
		expect(html).toContain('background-color: #000000');
		expect(html).toContain('color: #ffffff');
	});

	it('should escape HTML in block data', () => {
		const html = blocksToPreviewHtml([
			makeBlock('text', { content: '<script>alert("xss")</script>' }),
		]);
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('should handle unknown block types gracefully', () => {
		const html = blocksToPreviewHtml([makeBlock('unknown-type')]);
		expect(html).toContain('<!-- unknown block type: unknown-type -->');
	});

	it('should render columns block', () => {
		const html = blocksToPreviewHtml([
			makeBlock('columns', {
				columns: [
					{ blocks: [{ type: 'text', id: 'c1', data: { content: 'Left' } }] },
					{ blocks: [{ type: 'text', id: 'c2', data: { content: 'Right' } }] },
				],
			}),
		]);
		expect(html).toContain('Left');
		expect(html).toContain('Right');
		expect(html).toContain('width: 50%');
	});
});

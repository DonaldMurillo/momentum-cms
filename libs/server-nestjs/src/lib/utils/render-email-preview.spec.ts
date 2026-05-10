import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderEmailPreviewHTML, __testHooks } from './render-email-preview';

describe('renderEmailPreviewHTML', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unmock('@momentumcms/email');
	});

	it('returns the empty-blocks placeholder when blocks field is absent', async () => {
		const html = await renderEmailPreviewHTML({}, 'blocks');
		expect(html).toBe(__testHooks.EMPTY_BLOCKS_HTML);
	});

	it('returns the empty-blocks placeholder when blocks is an empty array', async () => {
		const html = await renderEmailPreviewHTML({ blocks: [] }, 'blocks');
		expect(html).toBe(__testHooks.EMPTY_BLOCKS_HTML);
	});

	it('returns the empty-blocks placeholder when blocks is not an array', async () => {
		const html = await renderEmailPreviewHTML({ blocks: 'not-an-array' }, 'blocks');
		expect(html).toBe(__testHooks.EMPTY_BLOCKS_HTML);
	});

	it('forwards blocks to renderEmailFromBlocks and returns its rendered HTML', async () => {
		const renderSpy = vi.fn(
			(template: { blocks: unknown[]; theme?: unknown }) =>
				`<html><body data-blocks="${template.blocks.length}">rendered</body></html>`,
		);
		vi.doMock('@momentumcms/email', () => ({ renderEmailFromBlocks: renderSpy }));

		const { renderEmailPreviewHTML: freshRender } = await import('./render-email-preview');
		const html = await freshRender(
			{
				blocks: [
					{ type: 'heading', text: 'Hi' },
					{ type: 'paragraph', text: 'Hello' },
				],
			},
			'blocks',
		);

		expect(renderSpy).toHaveBeenCalledOnce();
		const arg = renderSpy.mock.calls[0]?.[0];
		expect(arg?.blocks).toHaveLength(2);
		expect(html).toContain('data-blocks="2"');
		expect(html).toContain('rendered');
	});

	it('returns the unavailable-fallback when @momentumcms/email throws on render', async () => {
		vi.doMock('@momentumcms/email', () => ({
			renderEmailFromBlocks: () => {
				throw new Error('boom');
			},
		}));

		const { renderEmailPreviewHTML: freshRender } = await import('./render-email-preview');
		const html = await freshRender({ blocks: [{ type: 'heading' }] }, 'blocks');

		expect(html).toBe(__testHooks.UNAVAILABLE_HTML);
	});
});

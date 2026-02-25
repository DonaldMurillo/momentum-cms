import { describe, it, expect } from 'vitest';
import { blocksToPlainText } from './blocks-to-plain-text';
import type { EmailBlock } from '../../types';

function block(type: string, data: Record<string, unknown>): EmailBlock {
	return { type, data, id: `test-${type}` };
}

describe('blocksToPlainText', () => {
	it('should return empty string for empty array', () => {
		expect(blocksToPlainText([])).toBe('');
	});

	it('should extract header title', () => {
		const result = blocksToPlainText([block('header', { title: 'Welcome' })]);
		expect(result).toBe('Welcome');
	});

	it('should extract header title and subtitle', () => {
		const result = blocksToPlainText([
			block('header', { title: 'Welcome', subtitle: 'To our app' }),
		]);
		expect(result).toBe('Welcome\nTo our app');
	});

	it('should extract text content', () => {
		const result = blocksToPlainText([block('text', { content: 'Hello world' })]);
		expect(result).toBe('Hello world');
	});

	it('should extract button label and href', () => {
		const result = blocksToPlainText([
			block('button', { label: 'Click here', href: 'https://example.com' }),
		]);
		expect(result).toBe('Click here: https://example.com');
	});

	it('should extract button label only when no href', () => {
		const result = blocksToPlainText([block('button', { label: 'Click here' })]);
		expect(result).toBe('Click here');
	});

	it('should extract footer text', () => {
		const result = blocksToPlainText([block('footer', { text: 'The Momentum Team' })]);
		expect(result).toBe('The Momentum Team');
	});

	it('should return empty for divider blocks', () => {
		const result = blocksToPlainText([block('divider', {})]);
		expect(result).toBe('');
	});

	it('should return empty for spacer blocks', () => {
		const result = blocksToPlainText([block('spacer', { height: 24 })]);
		expect(result).toBe('');
	});

	it('should return empty for image blocks', () => {
		const result = blocksToPlainText([
			block('image', { src: 'https://example.com/img.png', alt: 'Logo' }),
		]);
		expect(result).toBe('');
	});

	it('should recurse into columns blocks', () => {
		const result = blocksToPlainText([
			block('columns', {
				columns: [
					{
						blocks: [{ type: 'text', data: { content: 'Column 1' }, id: 'c1' }],
					},
					{
						blocks: [{ type: 'text', data: { content: 'Column 2' }, id: 'c2' }],
					},
				],
			}),
		]);
		expect(result).toBe('Column 1\n\nColumn 2');
	});

	it('should join multiple blocks with blank lines', () => {
		const result = blocksToPlainText([
			block('header', { title: 'Title' }),
			block('text', { content: 'Paragraph one.' }),
			block('button', { label: 'Go', href: 'https://example.com' }),
			block('footer', { text: 'Thanks' }),
		]);
		expect(result).toBe('Title\n\nParagraph one.\n\nGo: https://example.com\n\nThanks');
	});

	it('should skip visual-only blocks in mixed content', () => {
		const result = blocksToPlainText([
			block('header', { title: 'Title' }),
			block('divider', {}),
			block('spacer', { height: 24 }),
			block('text', { content: 'Content' }),
		]);
		expect(result).toBe('Title\n\nContent');
	});

	it('should handle blocks with missing data gracefully', () => {
		const result = blocksToPlainText([block('text', {}), block('header', {})]);
		expect(result).toBe('');
	});

	it('should handle unknown block types gracefully', () => {
		const result = blocksToPlainText([block('custom-unknown', { foo: 'bar' })]);
		expect(result).toBe('');
	});

	it('should limit recursion depth on deeply nested columns', () => {
		function makeNestedColumns(depth: number): EmailBlock {
			if (depth === 0) {
				return { type: 'text', data: { content: 'deep-leaf' }, id: `leaf-${depth}` };
			}
			return {
				type: 'columns',
				data: {
					columns: [{ blocks: [makeNestedColumns(depth - 1)] }],
				},
				id: `col-${depth}`,
			};
		}

		// 10 levels deep — should not throw
		const result = blocksToPlainText([makeNestedColumns(10)]);
		expect(typeof result).toBe('string');
		// The deepest leaf should NOT appear due to depth limit
		expect(result).not.toContain('deep-leaf');
	});
});

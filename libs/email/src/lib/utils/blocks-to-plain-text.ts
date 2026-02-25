import type { EmailBlock } from '../../types';

/** Maximum nesting depth for columns blocks to prevent stack overflow from recursive structures. */
const MAX_BLOCK_DEPTH = 5;

/**
 * Extract plain text content from email blocks.
 *
 * Produces a human-readable text version of an email for use as the
 * plain text fallback in multipart emails. Visual-only blocks (divider,
 * spacer, image) are skipped; text-bearing blocks are joined with blank lines.
 */
export function blocksToPlainText(blocks: EmailBlock[], depth = 0): string {
	const lines: string[] = [];

	for (const block of blocks) {
		const text = blockToText(block, depth);
		if (text) {
			lines.push(text);
		}
	}

	return lines.join('\n\n');
}

function blockToText(block: EmailBlock, depth: number): string {
	switch (block.type) {
		case 'header':
			return headerToText(block.data);
		case 'text':
			return String(block.data['content'] ?? '');
		case 'button':
			return buttonToText(block.data);
		case 'footer':
			return String(block.data['text'] ?? '');
		case 'columns':
			if (depth >= MAX_BLOCK_DEPTH) {
				console.warn('[momentum:email] Max nesting depth reached, skipping columns block');
				return '';
			}
			return columnsToText(block.data, depth);
		case 'divider':
		case 'spacer':
		case 'image':
			return '';
		default:
			return '';
	}
}

function headerToText(data: Record<string, unknown>): string {
	const title = String(data['title'] ?? '');
	const subtitle = data['subtitle'] ? String(data['subtitle']) : '';
	if (!title && !subtitle) return '';
	if (!subtitle) return title;
	return `${title}\n${subtitle}`;
}

function buttonToText(data: Record<string, unknown>): string {
	const label = String(data['label'] ?? '');
	const href = data['href'] ? String(data['href']) : '';
	if (!label) return '';
	if (!href) return label;
	return `${label}: ${href}`;
}

function columnsToText(data: Record<string, unknown>, depth: number): string {
	const columns = data['columns'];
	if (!Array.isArray(columns)) return '';

	const parts: string[] = [];
	for (const col of columns) {
		if (col && typeof col === 'object' && Array.isArray(col.blocks)) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- column blocks stored as unknown[], narrowed by array check
			const colText = blocksToPlainText(col.blocks as EmailBlock[], depth + 1);
			if (colText) {
				parts.push(colText);
			}
		}
	}

	return parts.join('\n\n');
}

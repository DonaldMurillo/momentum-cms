import type { EmailTemplate } from '../../types';
import { escapeHtml } from '../utils/escape-html';
import { inlineCss } from '../utils/css-inliner';
import { replaceBlockVariables } from '../utils/replace-variables';
import {
	sanitizeAlignment,
	sanitizeCssValue,
	sanitizeFontFamily,
	sanitizeCssNumber,
	sanitizeUrl,
} from '../utils/sanitize';
import { DEFAULT_EMAIL_THEME, type EmailTheme, type EmailBlock } from '../../types';

/**
 * Options for `renderEmailFromBlocks()`.
 */
export interface RenderBlocksOptions {
	/** Whether to inline CSS styles. @default true */
	inlineCss?: boolean;
	/**
	 * Template variables to substitute before rendering.
	 * Variables use `{{name}}` syntax in block data values.
	 * Must be substituted BEFORE rendering because `escapeHtml()` would
	 * mangle the braces.
	 */
	variables?: Record<string, string>;
}

/**
 * Render an email template from a JSON block array to an HTML string.
 *
 * This function maps block definitions to table-based HTML without
 * Angular component rendering — it generates the HTML directly from
 * the block data. Used by both the server (final render) and the
 * browser (preview).
 *
 * @param template The email template (blocks + optional theme).
 * @param options Optional render configuration.
 * @returns Rendered HTML string.
 */
export function renderEmailFromBlocks(
	template: EmailTemplate,
	options?: RenderBlocksOptions,
): string {
	const theme: EmailTheme = { ...DEFAULT_EMAIL_THEME, ...template.theme };
	const shouldInline = options?.inlineCss ?? true;

	// Substitute variables BEFORE rendering (escapeHtml would mangle {{braces}})
	const blocks = options?.variables
		? replaceBlockVariables(template.blocks, options.variables)
		: template.blocks;

	const validBlocks = blocks.filter((block) => {
		if (!isValidBlock(block)) {
			console.warn('[momentum:email] Skipping invalid email block:', block);
			return false;
		}
		return true;
	});
	const blocksHtml = validBlocks.map((block) => renderBlock(block, theme, 0)).join('\n');

	let html = wrapEmailDocument(blocksHtml, theme);

	if (shouldInline) {
		html = inlineCss(html);
	}

	return html;
}

function wrapEmailDocument(content: string, theme: EmailTheme): string {
	const fontFamily = sanitizeFontFamily(theme.fontFamily);
	const bgColor = sanitizeCssValue(theme.backgroundColor);
	const borderRadius = sanitizeCssValue(theme.borderRadius);

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ${fontFamily}; background-color: ${bgColor}; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${bgColor};">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: ${borderRadius}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Type guard to validate that a value is a well-formed EmailBlock.
 * Used to filter out malformed blocks from DB-stored templates.
 */
export function isValidBlock(block: unknown): block is EmailBlock {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing from unknown requires assertion
	const rec = block as Record<string, unknown>;
	return (
		typeof block === 'object' &&
		block !== null &&
		typeof rec['id'] === 'string' &&
		rec['id'].length > 0 &&
		typeof rec['type'] === 'string' &&
		typeof rec['data'] === 'object' &&
		rec['data'] !== null
	);
}

/** Maximum nesting depth for columns blocks to prevent stack overflow from recursive structures. */
const MAX_BLOCK_DEPTH = 5;

function renderBlock(block: EmailBlock, theme: EmailTheme, depth: number): string {
	switch (block.type) {
		case 'header':
			return renderHeaderBlock(block.data, theme);
		case 'text':
			return renderTextBlock(block.data, theme);
		case 'button':
			return renderButtonBlock(block.data, theme);
		case 'image':
			return renderImageBlock(block.data);
		case 'divider':
			return renderDividerBlock(block.data);
		case 'spacer':
			return renderSpacerBlock(block.data);
		case 'columns':
			if (depth >= MAX_BLOCK_DEPTH) {
				console.warn('[momentum:email] Max nesting depth reached, skipping columns block');
				return '';
			}
			return renderColumnsBlock(block.data, theme, depth);
		case 'footer':
			return renderFooterBlock(block.data, theme);
		default:
			return `<!-- unknown block type: ${escapeHtml(block.type)} -->`;
	}
}

function renderHeaderBlock(data: Record<string, unknown>, theme: EmailTheme): string {
	const title = escapeHtml(String(data['title'] ?? ''));
	const subtitle = data['subtitle'] ? escapeHtml(String(data['subtitle'])) : '';
	const alignment = sanitizeAlignment(String(data['alignment'] ?? 'left'));

	return `<h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: ${sanitizeCssValue(theme.textColor)}; text-align: ${alignment};">${title}</h1>${subtitle ? `<p style="margin: 0 0 16px; font-size: 16px; color: ${sanitizeCssValue(theme.mutedColor)}; text-align: ${alignment};">${subtitle}</p>` : ''}`;
}

function renderTextBlock(data: Record<string, unknown>, theme: EmailTheme): string {
	const content = escapeHtml(String(data['content'] ?? ''));
	const fontSize = sanitizeCssNumber(data['fontSize'], 16);
	const color = sanitizeCssValue(String(data['color'] ?? theme.textColor));
	const alignment = sanitizeAlignment(String(data['alignment'] ?? 'left'));

	return `<p style="margin: 0 0 16px; font-size: ${fontSize}px; color: ${color}; text-align: ${alignment}; line-height: 1.6;">${content}</p>`;
}

function renderButtonBlock(data: Record<string, unknown>, theme: EmailTheme): string {
	const label = escapeHtml(String(data['label'] ?? 'Click here'));
	const href = escapeHtml(sanitizeUrl(String(data['href'] ?? '#')));
	const bgColor = sanitizeCssValue(String(data['backgroundColor'] ?? theme.primaryColor));
	const color = sanitizeCssValue(String(data['color'] ?? '#ffffff'));
	const alignment = sanitizeAlignment(String(data['alignment'] ?? 'left'));

	return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td style="padding: 0 0 16px;" align="${alignment}">
      <a href="${href}" style="display: inline-block; padding: 12px 24px; background-color: ${bgColor}; color: ${color}; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">${label}</a>
    </td>
  </tr>
</table>`;
}

function renderImageBlock(data: Record<string, unknown>): string {
	const rawSrc = String(data['src'] ?? '').trim();
	if (!rawSrc) return '<!-- image block: no src configured -->';

	const src = escapeHtml(sanitizeUrl(rawSrc));
	const alt = escapeHtml(String(data['alt'] ?? ''));
	const width = sanitizeCssValue(String(data['width'] ?? '100%'));

	const img = `<img src="${src}" alt="${alt}" width="${width}" style="display: block; max-width: 100%; height: auto; border: 0;">`;

	if (data['href']) {
		const href = escapeHtml(sanitizeUrl(String(data['href'])));
		return `<a href="${href}" style="display: block;">${img}</a>`;
	}

	return img;
}

function renderDividerBlock(data: Record<string, unknown>): string {
	const color = sanitizeCssValue(String(data['color'] ?? '#e4e4e7'));
	const margin = sanitizeCssValue(String(data['margin'] ?? '24px 0'));

	return `<hr style="border: none; border-top: 1px solid ${color}; margin: ${margin};">`;
}

function renderSpacerBlock(data: Record<string, unknown>): string {
	const height = sanitizeCssNumber(data['height'], 24);

	return `<div style="height: ${height}px; line-height: ${height}px; font-size: 1px;">&nbsp;</div>`;
}

function renderColumnsBlock(
	data: Record<string, unknown>,
	theme: EmailTheme,
	depth: number,
): string {
	const rawColumns = data['columns'];
	const columns = Array.isArray(rawColumns) ? rawColumns : [];
	const width = Math.floor(100 / (columns.length || 1));

	const tds = columns
		.map((col: unknown) => {
			const colObj =
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing unknown column objects
				typeof col === 'object' && col !== null ? (col as Record<string, unknown>) : {};
			const rawBlocks = colObj['blocks'];
			const colContent = (Array.isArray(rawBlocks) ? rawBlocks : [])
				.filter(isValidBlock)
				.map((b) => renderBlock(b, theme, depth + 1))
				.join('\n');
			return `<td style="width: ${width}%; vertical-align: top; padding: 0 8px;">${colContent}</td>`;
		})
		.join('\n');

	return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${tds}</tr></table>`;
}

function renderFooterBlock(data: Record<string, unknown>, theme: EmailTheme): string {
	const text = escapeHtml(String(data['text'] ?? ''));
	const color = sanitizeCssValue(String(data['color'] ?? theme.mutedColor));

	return `<p style="margin: 16px 0 0; font-size: 12px; color: ${color}; text-align: center;">${text}</p>`;
}

import type { EmailBlock, EmailTheme } from '@momentumcms/email';
import {
	DEFAULT_EMAIL_THEME,
	sanitizeAlignment,
	sanitizeCssValue,
	sanitizeCssNumber,
	isValidBlock,
} from '@momentumcms/email';

/**
 * Convert email blocks to an HTML string for live preview in the browser.
 *
 * This mirrors the server-side `renderEmailFromBlocks()` output so the
 * preview matches what the final rendered email looks like.
 */
export function blocksToPreviewHtml(blocks: EmailBlock[], theme?: Partial<EmailTheme>): string {
	const t: EmailTheme = { ...DEFAULT_EMAIL_THEME, ...theme };
	const validBlocks = blocks.filter((block) => {
		if (!isValidBlock(block)) {
			console.warn('[momentum:email-builder] Skipping invalid email block:', block);
			return false;
		}
		return true;
	});
	const blocksHtml = validBlocks.map((block) => renderBlock(block, t)).join('\n');
	return wrapPreviewDocument(blocksHtml, t);
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function wrapPreviewDocument(content: string, theme: EmailTheme): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ${theme.fontFamily}; background-color: ${theme.backgroundColor}; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${theme.backgroundColor};">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: ${theme.borderRadius}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
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

function renderBlock(block: EmailBlock, theme: EmailTheme): string {
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
			return renderColumnsBlock(block.data, theme);
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
	const href = escapeHtml(String(data['href'] ?? '#'));
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
	const src = escapeHtml(String(data['src'] ?? ''));
	const alt = escapeHtml(String(data['alt'] ?? ''));
	const width = sanitizeCssValue(String(data['width'] ?? '100%'));

	const img = `<img src="${src}" alt="${alt}" width="${width}" style="display: block; max-width: 100%; height: auto; border: 0;">`;

	if (data['href']) {
		const href = escapeHtml(String(data['href']));
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

function renderColumnsBlock(data: Record<string, unknown>, theme: EmailTheme): string {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const columns = (data['columns'] as Array<{ blocks: EmailBlock[] }>) ?? [];
	const width = Math.floor(100 / (columns.length || 1));

	const tds = columns
		.map((col) => {
			const colContent = (col.blocks ?? []).map((b) => renderBlock(b, theme)).join('\n');
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

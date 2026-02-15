import { defineEventHandler } from 'h3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * SPA fallback for Storybook.
 *
 * Nitro's publicAssets serves the static files directly (JS, CSS, etc.),
 * but Storybook's client-side routing (iframe.html, etc.) needs a fallback
 * to index.html for paths that don't match a physical file.
 */
export default defineEventHandler(() => {
	const storybookDir = resolve('dist/storybook/ui');
	const html = readFileSync(resolve(storybookDir, 'index.html'), 'utf-8');
	return html;
});

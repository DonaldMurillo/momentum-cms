/**
 * Server-safe exports for @momentumcms/email.
 *
 * This sub-path excludes Angular components so it can be imported
 * in server environments (Nitro/Rollup) without requiring the JIT compiler.
 */
export {
	renderEmailFromBlocks,
	type RenderBlocksOptions,
	isValidBlock,
} from './lib/render/render-blocks';
export { replaceVariables, replaceBlockVariables } from './lib/utils/replace-variables';
export { blocksToPlainText } from './lib/utils/blocks-to-plain-text';
export { inlineCss } from './lib/utils/css-inliner';
export { escapeHtml } from './lib/utils/escape-html';
export type {
	EmailBlock,
	EmailBlockDefinition,
	EmailBlockField,
	EmailTemplate,
	EmailTheme,
} from './types';
export { DEFAULT_EMAIL_THEME } from './types';

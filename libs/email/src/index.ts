// Render functions
export { renderEmail } from './lib/render/render-email';
export { renderEmailFromBlocks, type RenderBlocksOptions } from './lib/render/render-blocks';
export { EMAIL_DATA, injectEmailData, type RenderEmailOptions } from './lib/render/render-types';

// Template variable utilities
export { replaceVariables, replaceBlockVariables } from './lib/utils/replace-variables';

// Default email template blocks
export {
	DEFAULT_PASSWORD_RESET_BLOCKS,
	DEFAULT_VERIFICATION_BLOCKS,
} from './lib/templates/default-templates';

// Components
export { EmlBody } from './lib/components/eml-body.component';
export { EmlContainer } from './lib/components/eml-container.component';
export { EmlSection } from './lib/components/eml-section.component';
export { EmlRow } from './lib/components/eml-row.component';
export { EmlColumn } from './lib/components/eml-column.component';
export { EmlText } from './lib/components/eml-text.component';
export { EmlHeading } from './lib/components/eml-heading.component';
export { EmlButton } from './lib/components/eml-button.component';
export { EmlLink } from './lib/components/eml-link.component';
export { EmlImage } from './lib/components/eml-image.component';
export { EmlDivider } from './lib/components/eml-divider.component';
export { EmlPreview } from './lib/components/eml-preview.component';
export { EmlSpacer } from './lib/components/eml-spacer.component';
export { EmlFooter } from './lib/components/eml-footer.component';

// Utilities
export { escapeHtml } from './lib/utils/escape-html';
export { inlineCss } from './lib/utils/css-inliner';
export { sanitizeAlignment, sanitizeCssValue, sanitizeCssNumber } from './lib/utils/sanitize';
export { blocksToPlainText } from './lib/utils/blocks-to-plain-text';

// Validation
export { isValidBlock } from './lib/render/render-blocks';

// Re-export types and constants from universal sub-path
export type {
	EmailBlock,
	EmailBlockDefinition,
	EmailBlockField,
	EmailTemplate,
	EmailTheme,
} from './types';
export { DEFAULT_EMAIL_THEME } from './types';

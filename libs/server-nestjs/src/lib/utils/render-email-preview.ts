/**
 * Adapter-side fallback for rendering email-builder previews.
 *
 * Imports `@momentumcms/email` lazily so consumers that don't ship email
 * features don't pay the bundle / load cost. Returns a placeholder when the
 * package isn't installed, blocks are missing, or rendering throws.
 */

interface EmailRendererModule {
	renderEmailFromBlocks: (template: { blocks: unknown[]; theme?: unknown }) => string;
}

const EMPTY_BLOCKS_HTML =
	'<html><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;color:#666;font-family:sans-serif"><p>No email blocks yet.</p></body></html>';

const UNAVAILABLE_HTML = '<html><body><p>Email preview unavailable</p></body></html>';

export async function renderEmailPreviewHTML(
	doc: Record<string, unknown>,
	blocksFieldName: string,
): Promise<string> {
	const blocks = doc[blocksFieldName];
	if (!Array.isArray(blocks) || blocks.length === 0) {
		return EMPTY_BLOCKS_HTML;
	}
	try {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- dynamic import returns unknown shape; we narrow via the EmailRendererModule contract
		const mod = (await import('@momentumcms/email')) as unknown as EmailRendererModule;
		return mod.renderEmailFromBlocks({ blocks });
	} catch {
		return UNAVAILABLE_HTML;
	}
}

export const __testHooks = { EMPTY_BLOCKS_HTML, UNAVAILABLE_HTML };

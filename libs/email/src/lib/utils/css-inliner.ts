import juice from 'juice';

/**
 * Inline CSS from `<style>` tags into element `style` attributes.
 *
 * Email clients strip `<style>` tags and class-based CSS, so all
 * styles must be inlined as `style=""` attributes for consistent rendering.
 *
 * Media queries are preserved in a `<style>` tag for responsive email support.
 */
export function inlineCss(html: string): string {
	return juice(html, {
		removeStyleTags: true,
		preserveMediaQueries: true,
		preserveFontFaces: true,
		insertPreservedExtraCss: true,
	});
}

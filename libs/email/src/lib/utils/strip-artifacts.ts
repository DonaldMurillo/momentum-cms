/**
 * Strip Angular SSR artifacts from rendered HTML.
 *
 * `renderApplication` adds comments, `ng-reflect-*` attributes, `_nghost-*`
 * attributes, and other Angular-specific markers that are unnecessary in
 * email output and can break rendering in some email clients.
 */
export function stripAngularArtifacts(html: string): string {
	return (
		html
			// Remove HTML comments (Angular container markers, hydration hints)
			.replace(/<!--[\s\S]*?-->/g, '')
			// Remove ng-reflect-* debug attributes
			.replace(/\s*ng-reflect-[\w-]+="[^"]*"/g, '')
			// Remove _nghost-* and _ngcontent-* scoping attributes
			.replace(/\s*_ng(?:host|content)-[\w-]+(?:="")?/g, '')
			// Remove ng-version attribute
			.replace(/\s*ng-version="[^"]*"/g, '')
			// Remove ng-server-context attribute
			.replace(/\s*ng-server-context="[^"]*"/g, '')
			// Remove ngh hydration attribute
			.replace(/\s*ngh="[^"]*"/g, '')
			// Collapse multiple whitespace into single spaces (cleanup)
			.replace(/\n\s*\n/g, '\n')
	);
}

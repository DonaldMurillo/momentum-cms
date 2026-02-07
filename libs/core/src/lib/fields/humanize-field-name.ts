/**
 * Convert a field name to a human-readable title.
 *
 * Supports camelCase, PascalCase, snake_case, kebab-case, and combinations.
 *
 * Examples:
 *   firstName -> "First Name"
 *   first_name -> "First Name"
 *   SEOTitle -> "SEO Title"
 *   createdAt -> "Created At"
 */
export function humanizeFieldName(name: string): string {
	if (!name) return '';

	return (
		name
			// Insert space before uppercase letters following lowercase (camelCase boundary)
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			// Insert space before uppercase letter followed by lowercase when preceded by uppercase (acronym boundary)
			.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
			// Replace underscores and hyphens with spaces
			.replace(/[_-]+/g, ' ')
			// Capitalize first letter of each word
			.replace(/\b\w/g, (char) => char.toUpperCase())
			.trim()
	);
}

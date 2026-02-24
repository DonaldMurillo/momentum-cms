import type { EmailBlock } from '../../types';

/**
 * Replace `{{variable}}` placeholders in a string with their values.
 *
 * @example
 * ```typescript
 * replaceVariables('Hello {{name}}, visit {{url}}', { name: 'Alice', url: 'https://example.com' });
 * // => 'Hello Alice, visit https://example.com'
 * ```
 */
export function replaceVariables(text: string, variables: Record<string, string>): string {
	return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
}

/**
 * Deep-clone email blocks and replace `{{variable}}` placeholders in all string
 * values of `block.data`.
 *
 * IMPORTANT: This must be called BEFORE passing blocks to `renderEmailFromBlocks()`,
 * because the renderer calls `escapeHtml()` on text content. If variables like
 * `{{url}}` are not substituted first, the braces become `&#123;&#123;url&#125;&#125;`.
 */
export function replaceBlockVariables(
	blocks: EmailBlock[],
	variables: Record<string, string>,
): EmailBlock[] {
	return blocks.map((block) => ({
		...block,
		data: replaceDataVariables(block.data, variables),
	}));
}

function replaceDataVariables(
	data: Record<string, unknown>,
	variables: Record<string, string>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (typeof value === 'string') {
			result[key] = replaceVariables(value, variables);
		} else if (Array.isArray(value)) {
			result[key] = value.map((item: unknown) => {
				if (typeof item === 'object' && item !== null && 'blocks' in item) {
					// Nested column blocks — safe to access .blocks after the 'in' check
					const col = item as Record<string, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- narrowed by 'blocks' in item
					const nestedBlocks = Array.isArray(col['blocks']) ? (col['blocks'] as EmailBlock[]) : []; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- validated as array
					return { ...col, blocks: replaceBlockVariables(nestedBlocks, variables) };
				}
				return item;
			});
		} else {
			result[key] = value;
		}
	}
	return result;
}

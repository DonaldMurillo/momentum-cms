/**
 * ESLint rule: no-non-null-assertion-disable
 *
 * Bans eslint-disable comments that suppress @typescript-eslint/no-non-null-assertion.
 * Non-null assertions bypass TypeScript's type system — always use a type guard instead.
 */
module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow eslint-disable comments that suppress @typescript-eslint/no-non-null-assertion',
			category: 'Best Practices',
			recommended: true,
		},
		messages: {
			noDisableNonNullAssertion:
				'Do not disable @typescript-eslint/no-non-null-assertion. Use a type guard (if/return, nullish coalescing) instead of a non-null assertion.',
		},
		schema: [],
	},
	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		return {
			Program() {
				for (const comment of sourceCode.getAllComments()) {
					const text = comment.value.trim();
					// Match eslint-disable, eslint-disable-line, eslint-disable-next-line
					if (
						/^eslint-disable(?:-next-line|-line)?/.test(text) &&
						text.includes('@typescript-eslint/no-non-null-assertion')
					) {
						context.report({ node: comment, messageId: 'noDisableNonNullAssertion' });
					}
				}
			},
		};
	},
};

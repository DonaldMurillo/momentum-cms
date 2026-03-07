/**
 * ESLint rule: no-non-null-assertion-disable
 *
 * Bans eslint-disable comments that suppress protected rules.
 * These rules exist for a reason — disabling them defeats the purpose.
 */

/** Rules that must never be disabled via eslint-disable comments. */
const PROTECTED_RULES = [
	'@typescript-eslint/no-non-null-assertion',
	'local/no-silent-test-exit',
];

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow eslint-disable comments that suppress protected rules (no-non-null-assertion, no-silent-test-exit)',
			category: 'Best Practices',
			recommended: true,
		},
		messages: {
			noDisableProtectedRule:
				'Do not disable {{ rule }}. These rules exist to prevent real bugs — fix the underlying code instead.',
		},
		schema: [],
	},
	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		return {
			Program() {
				for (const comment of sourceCode.getAllComments()) {
					const text = comment.value.trim();
					if (!/^eslint-disable(?:-next-line|-line)?/.test(text)) continue;

					for (const rule of PROTECTED_RULES) {
						if (text.includes(rule)) {
							context.report({
								node: comment,
								messageId: 'noDisableProtectedRule',
								data: { rule },
							});
						}
					}
				}
			},
		};
	},
};

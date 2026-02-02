/**
 * ESLint rule: no-standalone-true
 *
 * Disallows redundant `standalone: true` in Angular components.
 * In Angular 21+, components are standalone by default.
 */
module.exports = {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow redundant standalone: true (default in Angular 21+)',
			category: 'Best Practices',
			recommended: true,
		},
		messages: {
			noStandaloneTrue:
				'Remove "standalone: true" - it is the default in Angular 21+. Components are standalone by default.',
		},
		fixable: 'code',
		schema: [],
	},
	create(context) {
		return {
			Property(node) {
				// Check if this is a `standalone: true` property
				const keyName = node.key.name || (node.key.type === 'Literal' && node.key.value);
				const isStandalone = keyName === 'standalone';
				const isTrue = node.value.type === 'Literal' && node.value.value === true;

				if (isStandalone && isTrue) {
					context.report({
						node,
						messageId: 'noStandaloneTrue',
						fix(fixer) {
							// Get the source code
							const sourceCode = context.getSourceCode();
							const parent = node.parent;

							// Find the range to remove including trailing comma
							let rangeStart = node.range[0];
							let rangeEnd = node.range[1];

							// Check for trailing comma
							const tokenAfter = sourceCode.getTokenAfter(node);
							if (tokenAfter && tokenAfter.value === ',') {
								rangeEnd = tokenAfter.range[1];
							}

							// Check for leading comma if this is not the first property
							if (parent && parent.properties) {
								const propIndex = parent.properties.indexOf(node);
								if (propIndex > 0 && tokenAfter && tokenAfter.value !== ',') {
									// If no trailing comma, check for leading comma
									const tokenBefore = sourceCode.getTokenBefore(node);
									if (tokenBefore && tokenBefore.value === ',') {
										rangeStart = tokenBefore.range[0];
									}
								}
							}

							// Handle whitespace/newlines before the property
							const textBefore = sourceCode.text.slice(0, rangeStart);
							const lastNewline = textBefore.lastIndexOf('\n');
							if (lastNewline !== -1) {
								const lineContent = textBefore.slice(lastNewline + 1);
								if (lineContent.trim() === '') {
									rangeStart = lastNewline;
								}
							}

							return fixer.removeRange([rangeStart, rangeEnd]);
						},
					});
				}
			},
		};
	},
};

/**
 * ESLint rule: no-catch-silent-failure
 *
 * Disallows `.catch(() => false)`, `.catch(() => null)`, `.catch(() => {})` patterns
 * that silently swallow errors and make tests pass regardless of actual behavior.
 *
 * Playwright's `request.delete()` returns a response (never throws on 404),
 * so `.catch()` is unnecessary even in cleanup.
 */
module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow .catch(() => false/null/{}) patterns that silently swallow failures',
			category: 'Best Practices',
			recommended: true,
		},
		messages: {
			noCatchSilentFailure:
				'Do not use .catch(() => {{ falsy/empty }}) — this silently swallows errors and makes tests pass regardless of actual behavior. Let errors propagate or use explicit assertions.',
		},
		schema: [],
	},
	create(context) {
		return {
			CallExpression(node) {
				// Match: something.catch(...)
				if (
					node.callee.type !== 'MemberExpression' ||
					node.callee.property.type !== 'Identifier' ||
					node.callee.property.name !== 'catch'
				) {
					return;
				}

				const args = node.arguments;
				if (args.length !== 1) return;

				const callback = args[0];
				// Must be an arrow function or function expression
				if (
					callback.type !== 'ArrowFunctionExpression' &&
					callback.type !== 'FunctionExpression'
				) {
					return;
				}

				// If the callback declares a parameter, the developer acknowledged the error.
				// Only flag parameterless callbacks that silently discard.
				if (callback.params.length > 0) return;

				const body = callback.body;

				// Arrow with expression body: .catch(() => false) / .catch(() => null)
				if (callback.type === 'ArrowFunctionExpression' && body.type !== 'BlockStatement') {
					if (
						(body.type === 'Literal' &&
							(body.value === false || body.value === null)) ||
						(body.type === 'ObjectExpression' && body.properties.length === 0) ||
						(body.type === 'ArrayExpression' && body.elements.length === 0)
					) {
						context.report({ node, messageId: 'noCatchSilentFailure' });
						return;
					}
				}

				// Block body: .catch(() => {}) or .catch(() => { return false; })
				if (body.type === 'BlockStatement') {
					// Empty block: .catch(() => {})
					if (body.body.length === 0) {
						context.report({ node, messageId: 'noCatchSilentFailure' });
						return;
					}

					// Single return statement with falsy value
					if (
						body.body.length === 1 &&
						body.body[0].type === 'ReturnStatement' &&
						body.body[0].argument
					) {
						const arg = body.body[0].argument;
						if (
							(arg.type === 'Literal' && (arg.value === false || arg.value === null)) ||
							(arg.type === 'ObjectExpression' && arg.properties.length === 0)
						) {
							context.report({ node, messageId: 'noCatchSilentFailure' });
						}
					}
				}
			},
		};
	},
};

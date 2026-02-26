/**
 * ESLint rule: no-or-logic-assertions
 *
 * Disallows OR-logic inside expect() assertions like:
 *   expect(response.ok() || response.status() === 201).toBe(true)
 *   expect(hasA || hasB).toBe(true)
 *
 * These assertions pass if EITHER condition is true, masking failures.
 * Use exact assertions instead:
 *   expect(response.status()).toBe(201)
 */
module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow OR-logic (||) inside expect() assertions',
			category: 'Best Practices',
			recommended: true,
		},
		messages: {
			noOrLogicAssertions:
				'Do not use OR-logic (||) inside expect(). This makes assertions pass when EITHER condition is true, masking failures. Use exact assertions: expect(response.status()).toBe(201)',
		},
		schema: [],
	},
	create(context) {
		return {
			CallExpression(node) {
				// Match: expect(...)
				if (
					node.callee.type !== 'Identifier' ||
					node.callee.name !== 'expect'
				) {
					return;
				}

				const args = node.arguments;
				if (args.length === 0) return;

				const firstArg = args[0];

				// Check if the first argument contains a LogicalExpression with ||
				if (containsOrLogic(firstArg)) {
					context.report({ node, messageId: 'noOrLogicAssertions' });
				}
			},
		};

		/**
		 * Recursively checks if an AST node contains a || LogicalExpression
		 */
		function containsOrLogic(node) {
			if (!node || typeof node !== 'object') return false;

			if (node.type === 'LogicalExpression' && node.operator === '||') {
				return true;
			}

			// Check nested expressions (e.g., parenthesized expressions)
			if (node.type === 'LogicalExpression') {
				return containsOrLogic(node.left) || containsOrLogic(node.right);
			}

			return false;
		}
	},
};
